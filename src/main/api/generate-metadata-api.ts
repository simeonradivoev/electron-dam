import { readFile, stat } from 'fs/promises';
import path, { extname } from 'path';
import {
  AudioClassificationOutput,
  ImageClassificationOutput,
  pipeline,
} from '@huggingface/transformers';
import Store from 'electron-store';
import { Ollama } from 'ollama';
import sharp from 'sharp';
import zodToJsonSchema from 'zod-to-json-schema';
import { z } from 'zod/v3';
import {
  AutoTagType,
  StoreSchema,
  FileFormatsToFileTypes,
  FileType,
  MainIpcGetter,
} from '../../shared/constants';
import { addTask } from '../managers/task-manager';
import { compressStringToBase64, dataUrlToBuffer } from '../util';
import { checkMetadataIssues, findBundleInfoForFile } from './bundles-api';
import { getAllAssetsIn, getMetadata, operateOnMetadata, pathExistsSync } from './file-system-api';
import { GetAbsoluteThumbnailPath, GetAbsoluteThumbnailPathForFile } from './protocols';

let audioDecode: (buf: ArrayBuffer | Uint8Array) => Promise<AudioBuffer>;
let ollama: Ollama;

async function autoFileMetadata(
  filePath: FilePath,
  type: AutoTagType,
  abort: AbortSignal,
): Promise<FileMetadata> {
  const ext = extname(filePath.path);
  const fileType = FileFormatsToFileTypes.get(ext);
  switch (fileType) {
    case FileType.Textures: {
      if (type === AutoTagType.Ollama) {
        const Labels = z.object({
          description: z.string().describe('Description of the image'),
          labels: z.array(z.string()).describe('Labels describing the image'),
        });

        const imageBuffer = await readFile(path.join(filePath.projectDir, filePath.path));
        const encodedImage = await ollama.encodeImage(imageBuffer);

        const response = await ollama.chat({
          model: 'gemma3',
          messages: [
            {
              role: 'user',
              content: 'Describe the following image',
              images: [encodedImage],
            },
          ],
          format: zodToJsonSchema(Labels),
          think: false,
        });

        const labels = Labels.parse(JSON.parse(response.message.content));
        labels.labels = labels.labels.map((l) => l.toLowerCase());
        labels.labels.sort();
        const meta = await operateOnMetadata<FileMetadata>(filePath, async (m) => {
          m.tags = labels.labels;
          m.description = labels.description;
          return true;
        });
        return meta;
      }

      const classifier = await pipeline('image-classification', 'Xenova/vit-base-patch16-224', {
        device: 'gpu',
        dtype: 'fp16',
      });
      const output = (await classifier(
        path.join(filePath.projectDir, filePath.path),
      )) as ImageClassificationOutput;
      const tags = output.map((m) => m.label.toLowerCase()).sort();
      const meta = await operateOnMetadata<FileMetadata>(filePath, async (m) => {
        m.tags = tags;
        return true;
      });
      return meta;
    }
    case FileType.Audio: {
      const classifier = await pipeline(
        'audio-classification',
        'Xenova/ast-finetuned-audioset-10-10-0.4593',
        {
          device: 'gpu',
          dtype: 'q4',
        },
      );

      const buffer = await readFile(path.join(filePath.projectDir, filePath.path));
      const bufferData = new Uint8Array(buffer);
      const audioBuffer = await audioDecode(bufferData);
      let audioData = audioBuffer.getChannelData(0);
      if (Array.isArray(audioData)) {
        if (audioData.length > 1) {
          const SCALING_FACTOR = Math.sqrt(2);

          // Merge channels (into first channel to save memory)
          for (let i = 0; i < audioData[0].length; ++i) {
            audioData[0][i] = (SCALING_FACTOR * (audioData[0][i] + audioData[1][i])) / 2;
          }
        }

        // Select first channel
        audioData = audioData[0];
      }

      const output = (await classifier(audioData, { top_k: 6 })) as AudioClassificationOutput;
      const transformerTags = output.map((m) => m.label.toLowerCase()).sort();

      if (type === AutoTagType.Ollama) {
        const Labels = z.object({
          description: z.string().describe('Detailed and complete description of the audio'),
          labels: z
            .array(z.string())
            .describe('Labels describing the audio. A list of single word labels.'),
        });

        const bundle = await findBundleInfoForFile(filePath);
        const images: string[] = [];

        let systemContent = `Describe the audio and assign labes.
            Provide a complete and detailed description of the audio.
            Limit labels to single words when possible.
            Use the automatically generated labels as clues as they may be unreliable.
            Include as many labels as you can.
            Format the output into JSON.`;
        let content = `Describe the audio with filename ${filePath}.
          Unreliable automatically generated tags are ${transformerTags.join(',')}.`;
        if (bundle) {
          content += `Part of the asset bundle named ${filePath} with the description: \n ${bundle.bundle.description}`;
          systemContent += `\nTake into account the name of the file as it might include clues.
            Take into account the bundle information such as name and description if provided.`;
          if (bundle.previewUrl) {
            const previewPath = { projectDir: filePath.projectDir, path: bundle.previewUrl };
            if (pathExistsSync(previewPath)) {
              const imageBuffer = await readFile(
                path.join(previewPath.projectDir, previewPath.path),
              );
              images.push(await ollama.encodeImage(imageBuffer));
              systemContent += `\nTake into account the preview of the bundle the file is from`;
            }
          }
        }
        //systemContent += `Do not verbatium copy the automatically generated tags, just use them as reference.`;

        const response = await ollama.chat({
          model: 'gemma3',
          messages: [
            {
              role: 'system',
              content: systemContent,
            },
            {
              role: 'user',
              content,
              images,
            },
          ],
          format: zodToJsonSchema(Labels),
          think: false,
          options: { temperature: 0 },
        });

        console.log(response.message.content);
        const labels = Labels.parse(JSON.parse(response.message.content));
        labels.labels = labels.labels.map((l) => l.toLowerCase());
        labels.labels.sort();

        const meta = await operateOnMetadata<FileMetadata>(filePath, async (m) => {
          m.tags = labels.labels;
          m.description = labels.description;
          return true;
        });
        return meta;
      }

      const meta = await operateOnMetadata<FileMetadata>(filePath, async (m) => {
        m.tags = transformerTags;
        return true;
      });
      return meta;
    }
    default:
      break;
  }

  return getMetadata<FileMetadata>(filePath).then((m) => m ?? {});
}

async function getMissingMetadataFiles(folderPath: FilePath) {
  const allAssets = await getAllAssetsIn(folderPath);
  const metadatas = await Promise.all(
    allAssets.map((asset) =>
      checkMetadataIssues(folderPath.projectDir, asset).then((assetStat) => ({ asset, assetStat })),
    ),
  );
  return metadatas
    .filter(({ assetStat }) => assetStat.missingDescription && assetStat.hasBundle)
    .map(({ asset }) => asset);
}

async function autoFolderMetadata(folderPath: FilePath, type: AutoTagType, a: AbortSignal) {
  const assets = await getMissingMetadataFiles(folderPath);
  for (const asset of assets) {
    await autoFileMetadata({ projectDir: folderPath.projectDir, path: asset.path }, type, a);
  }
}

async function autoMetadata(destinationPath: FilePath, type: AutoTagType, a: AbortSignal) {
  const destinationStat = await stat(path.join(destinationPath.projectDir, destinationPath.path));
  if (destinationStat.isDirectory()) {
    await autoFolderMetadata(destinationPath, type, a);
    return null;
  }

  return autoFileMetadata(destinationPath, type, a);
}

export default async function InitializeGenerateMetadataApi(
  api: MainIpcGetter,
  store: Store<StoreSchema>,
) {
  ollama = new Ollama({ host: store.get('ollamaHost') });

  store.onDidChange('ollamaHost', (val) => {
    ollama = new Ollama({ host: val });
  });

  // hack to load it, issue with typescript loading
  const module = await (eval(`import('audio-decode')`) as Promise<any>);
  audioDecode = module.default;

  api.saveAudioPeaks = async (localPath, peaks) => {
    const filePath = { projectDir: store.get('projectDirectory'), path: localPath };
    const asolutePath = path.join(filePath.projectDir, filePath.path);
    const stats = await stat(asolutePath);
    await operateOnMetadata<AudioMetadata>(filePath, async (meta) => {
      meta.peaks = await compressStringToBase64(peaks);
      meta.lastModified = stats.mtimeMs;
      return true;
    });
  };
  api.saveAudioPreview = async (localPath, data) => {
    sharp(dataUrlToBuffer(data)).toFile(
      await GetAbsoluteThumbnailPathForFile({
        projectDir: store.get('projectDirectory'),
        path: localPath,
      }),
    );
  };
  api.autoMetadata = (pt, t) =>
    addTask('Auto Metadata ', (a, p) =>
      autoMetadata({ projectDir: store.get('projectDirectory'), path: pt }, t, a),
    );
}
