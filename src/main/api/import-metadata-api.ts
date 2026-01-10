import * as fs from 'fs';
import * as https from 'https';
import path, { normalize } from 'path';
import { setTimeout } from 'timers/promises';
import * as cheerio from 'cheerio';
import log from 'electron-log/main';
import ElectronStore from 'electron-store';
import { FilePath } from 'main/util';
import ollama from 'ollama';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import sharp from 'sharp';
import { util } from 'undici';
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

async function loadPageScreenshot(
  url: string,
  abort?: AbortSignal,
  progress?: (p: number) => void,
) {
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
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000, signal: abort });
  progress?.(0.5);

  // Use delay function instead of waitForTimeout
  await setTimeout(3000, undefined, { signal: abort });
  progress?.(0.6);

  return page.screenshot({ fullPage: false, optimizeForSpeed: true, type: 'webp' });
}

async function loadPageHtml(url: string, abort?: AbortSignal, progress?: (p: number) => void) {
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
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000, signal: abort });
  progress?.(0.5);

  // Use delay function instead of waitForTimeout
  await setTimeout(3000, undefined, { signal: abort });
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
    description: z
      .string()
      .max(512)
      .describe('Clear, detailed description of the bundle in Markdown format'),
    tags: z
      .array(z.string())
      .describe(
        `Relevant categorization tags (e.g., "3D", "weapons", "fantasy", "PBR", "mobile-ready")`,
      ),
  });

  const pageHtml = await loadPageHtml(address, abort, progress);
  const pageScreenshot = await loadPageScreenshot(address, abort, progress);
  const $ = cheerio.load(pageHtml);
  // Remove script, style, and other non-content tags
  $('script, style, noscript, iframe, svg').remove();

  const pageText = $('body').text().replace(/\s+/g, ' ').trim();
  log.silly(pageText);

  const format = zodToJsonSchema(Metadata);
  const content = `Extract the description of the main presented game asset pack in text. Look for its description and tags from the provided image.
          1. Description - A detailed description of the asset bundle in markdown format in under 512 characters.
          2. Tags - Relevant categorization tags (e.g., "3D", "weapons", "fantasy", "PBR", "mobile-ready")
          Rules:
            - Include a description of the bundle as well as a list of tags.
            - Include information what the bundle is about, the type of assets, its uses, etc.
            - Limit labels to single words when possible.
            - Format the output into JSON.
            - This information will be used in a Digital Asset Manager app, format the description to fit that purpose.
            - Do not include info about the store the pack is sold at. Only include info about the main pack.
            - Ignore all irrelevant information that is not about the main pack.
            - Return ONLY valid JSON matching the provided format.
            - Do not add any text before or after the JSON.
            - Do not include any price or deals information.
            - Do not include contact information.

          Return only the JSON object, no additional text.
            `;

  log.silly(pageText);

  const response = await ollama.chat({
    model: 'gemma3',
    messages: [
      {
        role: 'system',
        content,
      },
      {
        role: 'user',
        content: `Describe the following asset pack from the screenshot in the provided json format. Here is the page text contents for reference: ${pageText}`,
        images: [pageScreenshot],
      },
    ],
    format,
    think: false,
    options: {
      temperature: 0.3,
      top_p: 0.9,
      top_k: 40,
    },
    stream: true,
  });

  let message = '';
  for await (const part of response) {
    message += part.message.content;
    if (abort.aborted) {
      response.abort();
    }
  }

  log.silly(message);

  const metadata = Metadata.parse(JSON.parse(message));
  metadata.tags = metadata.tags.map((t) => t.toLowerCase());
  metadata.tags.sort();

  const bundle: BundleMetadata = {
    description: metadata.description,
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
  url: string | Uint8Array<ArrayBuffer>,
  abort?: AbortSignal,
  progress?: (p: number) => void,
): Promise<void> {
  const previewPath = bundlePath.join(`Preview${previewTypes[0]}`);

  if (url instanceof Uint8Array) {
    sharp(url).webp().toFile(previewPath.absolute);
    return;
  }

  if (url.startsWith('http')) {
    const pageHtml = await loadPageHtml(url, abort, progress);
    const $ = cheerio.load(pageHtml);

    const imageUrl = $('meta[property="og:image"]').attr('content');
    if (imageUrl) {
      const downloadPromise = new Promise<string>((resolve, reject) => {
        https.get(imageUrl, (res) => {
          if (res.statusCode === 200) {
            res
              .pipe(fs.createWriteStream(previewPath.absolute))
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
    if (url === previewPath.absolute) {
      throw new Error('Trying to use the same image as preview');
    }
    fs.createReadStream(url).pipe(sharp().webp()).toFile(previewPath.absolute);
  }

  progress?.(1);
}

export default function InitializeImportMetadataApi(
  api: MainIpcGetter,
  store: ElectronStore<StoreSchema>,
) {
  puppeteer.use(StealthPlugin());

  api.canImportBundleMetadata = async (url, type) => {
    if (type === ImportType.Ollama) {
      try {
        await ollama.version();
      } catch (error) {
        return false;
      }
    }

    return true;
  };
  api.importBundleMetadata = (url, type) =>
    addTask(`Importing Metadata with ${type}`, (abort, progress) =>
      importBundleMetadata(url, type, abort, progress),
    );
  api.downloadPreview = (p, url) =>
    addTask(`Downloading Preview`, (abort, progress) =>
      downloadPreview(FilePath.fromStore(store, normalize(p)), url, abort, progress),
    );
}
