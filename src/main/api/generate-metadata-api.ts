import { readFile, stat } from 'fs/promises';
import path, { extname, normalize } from 'path';
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
  ImportType,
} from '../../shared/constants';
import { addTask } from '../managers/task-manager';
import { compressStringToBase64, dataUrlToBuffer, FilePath, foreachAsync } from '../util';
import { checkMetadataIssues, findBundleInfoForFile } from './bundles-api';
import { thumbCache } from './cache/thumbnail-cache';
import {
  forAllAssetsIn,
  getAllAssetsIn,
  getMetadata,
  operateOnMetadata,
  pathExistsSync,
} from './file-system-api';
import { GetThumbnailPath, GetAbsoluteThumbnailPathForFile } from './protocols';
import { getSetting } from './settings';

let audioDecode: (buf: ArrayBuffer | Uint8Array) => Promise<AudioBuffer>;
let ollama: Ollama;

export default async function InitializeGenerateMetadataApi(
  api: MainIpcGetter,
  store: Store<StoreSchema>,
) {
  ollama = new Ollama({ host: store.get('ollamaHost') });

  store.onDidChange('ollamaHost', (val) => {
    ollama = new Ollama({ host: val });
  });

  async function autoFileMetadata(
    filePath: FilePath,
    type: AutoTagType,
    abort: AbortSignal,
  ): Promise<FileMetadata> {
    const ext = extname(filePath.path).toLocaleLowerCase();
    const fileType = FileFormatsToFileTypes.get(ext);
    switch (fileType) {
      case FileType.Textures: {
        if (type === AutoTagType.Ollama) {
          const Labels = z.object({
            description: z.string().describe('Description of the image'),
            labels: z.array(z.string()).describe('Labels describing the image'),
          });

          const imageBuffer = await readFile(filePath.absolute);
          const encodedImage = await ollama.encodeImage(imageBuffer);

          const response = await ollama.chat({
            model: getSetting(store, 'ollamaModel'),
            messages: [
              {
                role: 'user',
                content: 'Describe the following image',
                images: [encodedImage],
              },
            ],
            format: zodToJsonSchema(Labels),
            think: false,
            stream: true,
          });

          let message = '';
          for await (const part of response) {
            message += part.message.content;
            if (abort.aborted) {
              response.abort();
            }
          }

          const labels = Labels.parse(JSON.parse(message));
          labels.labels = labels.labels.map((l) => l.toLowerCase());
          labels.labels.sort();
          const meta = await operateOnMetadata(filePath, async (m) => {
            m.tags = labels.labels;
            m.description = labels.description;
            return true;
          });
          return meta;
        }

        const classifier = await pipeline('image-classification', 'Xenova/vit-base-patch16-224', {
          device: getSetting(store, 'embeddingDevice'),
          dtype: 'q4',
        });
        const output = (await classifier(
          path.join(filePath.projectDir, filePath.path),
        )) as ImageClassificationOutput;
        const tags = output.flatMap((m) => m.label.toLowerCase().split(',')).sort();
        const meta = await operateOnMetadata(filePath, async (m) => {
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
            device: getSetting(store, 'embeddingDevice'),
            dtype: 'q4',
          },
        );

        const buffer = await readFile(filePath.absolute);
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
            description: z
              .string()
              .max(512)
              .describe('Detailed and complete description of the audio'),
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
              const previewPath = filePath.with(bundle.previewUrl);
              if (pathExistsSync(previewPath)) {
                const imageBuffer = await readFile(previewPath.absolute);
                images.push(await ollama.encodeImage(imageBuffer));
                systemContent += `\nTake into account the preview of the bundle the file is from`;
              }
            }
          }
          //systemContent += `Do not verbatium copy the automatically generated tags, just use them as reference.`;

          const response = await ollama.chat({
            model: getSetting(store, 'ollamaModel'),
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

          const labels = Labels.parse(JSON.parse(response.message.content));
          labels.labels = labels.labels.map((l) => l.toLowerCase());
          labels.labels.sort();

          const meta = await operateOnMetadata(filePath, async (m) => {
            m.tags = labels.labels;
            m.description = labels.description;
            return true;
          });
          return meta;
        }

        const meta = await operateOnMetadata(filePath, async (m) => {
          m.tags = transformerTags;
          return true;
        });
        return meta;
      }
      default:
        break;
    }

    return getMetadata(filePath).then((m) => m ?? {});
  }

  async function autoMetadata(
    destinationPath: FilePath,
    type: AutoTagType,
    missingOnly: boolean,
    abort: AbortSignal,
    progress: (p: number) => void,
  ) {
    let assetCount = 0;
    const assetSelector = async (node: FileTreeNode) => {
      const metadataIssues = await checkMetadataIssues(destinationPath.projectDir, node);
      if (metadataIssues.hasBundle) {
        if (missingOnly) {
          if (metadataIssues.missingDescription) {
            return true;
          }
        } else {
          return true;
        }
      }

      return false;
    };
    await forAllAssetsIn(
      destinationPath,
      async (node) => {
        if (await assetSelector(node)) {
          assetCount += 1;
        }
      },
      true,
      abort,
    );
    let progressValue = 0;
    await forAllAssetsIn(
      destinationPath,
      async (node) => {
        if (await assetSelector(node)) {
          await autoFileMetadata(destinationPath.with(node.path), type, abort);
          progress((progressValue += 1 / assetCount));
        }
      },
      false,
      abort,
    );
  }

  async function removeDescription(filePath: FilePath) {
    await forAllAssetsIn(
      filePath,
      async (file) => {
        await operateOnMetadata(filePath.with(file.path), async (meta) => {
          if (meta.description) {
            meta.description = undefined;
            return true;
          }

          return false;
        });
      },
      true,
    );
  }

  // hack to load it, issue with typescript loading
  const module = await (eval(`import('audio-decode')`) as Promise<any>);
  audioDecode = module.default;

  api.saveAudioPeaks = async (localPath, peaks) => {
    const filePath = FilePath.fromStore(store, normalize(localPath));
    const stats = await stat(filePath.absolute);
    await operateOnMetadata(filePath, async (meta) => {
      meta.peaks = await compressStringToBase64(peaks);
      meta.lastModified = stats.mtimeMs;
      return true;
    });
  };
  api.saveAudioPreview = async (localPath, data) => {
    const previewPath = await GetAbsoluteThumbnailPathForFile(
      FilePath.fromStore(store, normalize(localPath)),
    );
    const previewStats = await sharp(dataUrlToBuffer(data))
      .resize({ width: 256, height: 256, withoutEnlargement: true })
      .toFile(path.join(previewPath.projectDir, previewPath.path));
    thumbCache?.set(previewPath.path, previewStats.size);
  };
  api.autoMetadata = (filePath, type, missingOnly) =>
    addTask('Auto Metadata ', (a, p) =>
      autoMetadata(FilePath.fromStore(store, normalize(filePath)), type, missingOnly, a, p),
    );
  api.canGenerateMetadata = async (assetPath, type) => {
    if (type === AutoTagType.Ollama) {
      try {
        await ollama.version();
      } catch (error) {
        return false;
      }
    }
    const bundle = await findBundleInfoForFile(FilePath.fromStore(store, normalize(assetPath)));
    return !!bundle?.bundle.description;
  };
  api.removeDescription = (p) => removeDescription(FilePath.fromStore(store, p));
}
