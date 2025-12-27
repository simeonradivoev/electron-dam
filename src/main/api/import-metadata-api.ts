import * as fs from 'fs';
import { copyFile } from 'fs/promises';
import * as https from 'https';
import path from 'path';
import { pipeline, SummarizationOutput } from '@huggingface/transformers';
import * as cheerio from 'cheerio';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import ElectronStore from 'electron-store';
import ollama from 'ollama';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import sharp from 'sharp';
import TurndownService from 'turndown';
import zodToJsonSchema from 'zod-to-json-schema';
import z from 'zod/v3';
import { StoreSchema, ImportType, MainIpcGetter, previewTypes } from '../../shared/constants';
import { addTask } from '../managers/task-manager';

async function openGraphBundleImport(
  url: string,
  abort: AbortSignal,
  progress: (p: number) => void,
): Promise<BundleMetadata> {
  const pageHtml = await loadPageHtml(url, abort, progress);
  const $ = cheerio.load(pageHtml);

  return {
    description:
      $('meta[name="description"]')?.attr('content') ??
      $('meta[property="og:description"]')?.attr('content'),
    tags: $('meta[name="keywords"]')?.attr('content')?.split(','),
    title: $('title')?.text() ?? $('meta[property="og:title"]')?.attr('content'),
    preview: $('meta[property="og:image"]')?.attr('content'),
  };
}

async function loadPageHtml(url: string, abort?: AbortSignal, progress?: (p: number) => void) {
  const abortHandler = () => {
    ollama.abort();
    abort?.removeEventListener('abort', abortHandler);
  };
  abort?.addEventListener('abort', abortHandler);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  progress?.(0.1);
  const page = await browser.newPage();
  progress?.(0.2);
  await page.setViewport({ width: 1280, height: 720 });
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  });
  progress?.(0.3);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
  progress?.(0.5);

  // Use delay function instead of waitForTimeout
  await new Promise((resolve) => {
    setTimeout(resolve, 3000);
  });
  progress?.(0.6);

  return page.content();
}

async function ollamaBundleImport(
  address: string,
  abort: AbortSignal,
  progress: (p: number) => void,
) {
  const abortHandler = () => {
    ollama.abort();
    abort.removeEventListener('abort', abortHandler);
  };
  abort.addEventListener('abort', abortHandler);
  const Metadata = z.object({
    description: z.string().describe('Detailed and complete description of the audio'),
    previewImageUrl: z.string().describe('The URL of the preview image'),
    tags: z
      .array(z.string())
      .describe('Labels describing the audio. A list of single word labels.'),
  });

  const pageHtml = await loadPageHtml(address, abort, progress);
  const $ = cheerio.load(pageHtml);
  // Remove script, style, and other non-content tags
  $('script, style, noscript, iframe, svg').remove();

  const pageText = $('body').text().replace(/\s+/g, ' ').trim();
  console.log(pageText);

  const format = zodToJsonSchema(Metadata);
  const content = `Extract the description of the main presented game asset pack in text. Look for its description and tags.
          1. Description - A clear, concise description of the asset bundle
          2. Tags - Relevant categorization tags (e.g., "3D", "weapons", "fantasy", "PBR", "mobile-ready")
          Rules:
            - Include a description of the bundle as well as a list of tags.
            - Limit labels to single words when possible.
            - Format the output into JSON.
            - This information will be used in a Digital Asset Manager app, format the description to fit that purpose.
            - Do not include info about the store the pack is sold at. Only include info about the main pack.
            - Ignore all irrelevant information that is not about the main pack.
            - Return ONLY valid JSON matching the provided format.
            - Do not add any text before or after the JSON.
            - Do not include any price or deals information.
          Content:
            ${pageText}

          Return only the JSON object, no additional text.
            `;

  console.log(pageText);

  const response = await ollama.chat({
    model: 'gemma3',
    messages: [
      {
        role: 'system',
        content,
      },
    ],
    format,
    think: false,
    options: {
      temperature: 0.3,
      top_p: 0.9,
      top_k: 40,
    },
  });

  console.log(response.message.content);
  const metadata = Metadata.parse(JSON.parse(response.message.content));
  metadata.tags = metadata.tags.map((t) => t.toLowerCase());
  metadata.tags.sort();

  const bundle: BundleMetadata = {
    description: metadata.description,
    preview: metadata.previewImageUrl,
    tags: metadata.tags,
  };

  progress(1);
  return bundle;
}

function importBundleMetadata(
  url: string,
  type: ImportType,
  abort: AbortSignal,
  progress: (p: number) => void,
): Promise<BundleMetadata> {
  switch (type) {
    case ImportType.Ollama:
      return ollamaBundleImport(url, abort, progress);

    default:
      return openGraphBundleImport(url, abort, progress);
  }
}

async function downloadPreview(
  bundlePath: FilePath,
  url: string,
  abort?: AbortSignal,
  progress?: (p: number) => void,
): Promise<void> {
  const previewPath = path.join(
    bundlePath.projectDir,
    bundlePath.path,
    `Preview${previewTypes[0]}`,
  );

  if (url.startsWith('http')) {
    const pageHtml = await loadPageHtml(url, abort, progress);
    const $ = cheerio.load(pageHtml);

    const imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl) {
      const downloadPromise = new Promise<string>((resolve, reject) => {
        https.get(imageUrl, (res) => {
          if (res.statusCode === 200) {
            res
              .pipe(fs.createWriteStream(previewPath))
              .on('error', reject)
              .once('close', () => resolve(imageUrl));
          } else {
            // Consume response data to free up memory
            res.resume();
            reject(new Error(`Request Failed With a Status Code: ${res.statusCode}`));
          }
        });
      });

      progress?.(0.9);
      await downloadPromise;
      progress?.(1);
      return;
    }
  }

  progress?.(0.9);

  // add better image detection
  if (fs.existsSync(url)) {
    if (url === previewPath) {
      throw new Error('Trying to use the same image as preview');
    }
    fs.createReadStream(url).pipe(sharp().webp()).toFile(previewPath);
  }

  progress?.(1);
}

export default function InitializeImportMetadataApi(
  api: MainIpcGetter,
  store: ElectronStore<StoreSchema>,
) {
  puppeteer.use(StealthPlugin());

  api.importBundleMetadata = (url, type) =>
    addTask(`Importing Metadata with ${type}`, (abort, progress) =>
      importBundleMetadata(url, type, abort, progress),
    );
  api.downloadPreview = (p, url) =>
    addTask(`Downloading Preview`, (abort, progress) =>
      downloadPreview({ projectDir: store.get('projectDirectory'), path: p }, url, abort, progress),
    );
}
