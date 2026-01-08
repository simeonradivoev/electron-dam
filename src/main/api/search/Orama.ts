import fs, { createReadStream, createWriteStream, existsSync } from 'fs';
import { readdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import zlib from 'zlib';
import {
  create,
  insert,
  search as oramaSearch,
  Results,
  update,
  getByID,
  count,
  remove as oramaRemove,
  SearchParams,
  AnySchema,
  SearchableType,
  load,
  save,
} from '@orama/orama';
import { persist, restore, restoreFromFile } from '@orama/plugin-data-persistence';
import { pluginQPS } from '@orama/plugin-qps';
import log from 'electron-log/main';
import ElectronStore from 'electron-store';
import { FileHasher, FilePath } from 'main/util';
import { number } from 'zod/v3';
import { FileType, StoreSchema } from '../../../shared/constants';
import { forAllAssetsInProject } from '../file-system-api';
import { getSetting } from '../settings';
import { generate } from './EmbeddingsService';

const SearchSchema: { [K in keyof SearchEntrySchema]: SearchableType | AnySchema } = {
  filename: 'string',
  description: 'string',
  path: 'string',
  fileType: 'string',
  bundleId: 'string',
  embeddings: 'vector[384]',
  tags: 'string[]',
  id: 'string',
  isArchived: 'boolean',
  isVirtual: 'boolean',
};

export interface IndexSchema {
  tags?: string[];
  description?: string;
  embeddings?: { data: number[] };
}

let db: ReturnType<typeof create<typeof SearchSchema>>;
const indexName = 'orama-index';

export async function initialize() {
  await createDatabase();
}

function isEmpty(): boolean {
  return db ? count(db) <= 0 : true;
}

async function clearOldIndexes(store: ElectronStore<StoreSchema>) {
  const cacheFolder = path.join(store.get('projectDirectory'), '.cache');
  const files = await readdir(cacheFolder, { withFileTypes: true });
  await Promise.all(
    files
      .filter((file) => file.isFile() && file.name.startsWith('searchIndex'))
      .map(async (file) => {
        await rm(path.join(cacheFolder, file.name));
        log.log('Removed Old Search Index ', file.name);
      }),
  );
}

export async function loadIndex(store: ElectronStore<StoreSchema>, hash: number) {
  const cacheFilePath = path.join(
    store.get('projectDirectory'),
    '.cache',
    `searchIndex${hash}.json`,
  );
  if (existsSync(cacheFilePath)) {
    let jsonString = '';
    const readStream = createReadStream(cacheFilePath);
    const gzip = readStream.pipe(zlib.createGunzip());
    // pipeline with async iteration
    for await (const chunk of gzip) {
      jsonString += chunk.toString('utf-8');
    }
    load(db, JSON.parse(jsonString));
    return true;
  }

  return false;
}

export async function persistIndex(store: ElectronStore<StoreSchema>, hash: number) {
  const cacheFilePath = path.join(
    store.get('projectDirectory'),
    '.cache',
    `searchIndex${hash}.json`,
  );

  if (existsSync(cacheFilePath)) {
    return false;
  }

  await clearOldIndexes(store);

  try {
    const data = save(db);
    const jsonString = JSON.stringify(data);
    const readable = Readable.from([jsonString]);
    const gzipStream = zlib.createGzip();
    const writeStream = createWriteStream(cacheFilePath);
    await pipeline(readable, gzipStream, writeStream);
    log.log('Orama index saved to disk');
    return true;
  } catch (error) {
    log.error('Could not save orama index to disk');
    log.error(error);
  }
  return false;
}

export async function clearDatabase() {
  log.log('Clearing Orama index by creating empty one...');
  await createDatabase();
}

async function destroyPreviousIndex(destinationPath: string) {
  await fs.promises.rm(path.join(destinationPath, `${indexName}.dpack`));
  log.log('Removed previous Orama index from disk');
}

export async function remove(file: FilePath) {
  await oramaRemove(db, file.path);
}

export async function index(entry: SearchEntrySchema) {
  const existing = getByID(db, entry.id);
  if (existing) {
    await update(db, entry.id, entry);
  } else {
    await insert(db, entry);
  }
}

export async function search(
  store: ElectronStore<StoreSchema>,
  query: string,
  typeFilter: FileType[],
  page: number,
): Promise<Results<SearchEntrySchema>> {
  if (!db) {
    throw new Error('Orama DB not initialized');
  }

  // Generate embedding for the query
  const vector = await generate(query);
  const limit = getSetting(store, 'searchResultsPerPage');

  const options: SearchParams<any, SearchEntrySchema> = {
    term: query,
    mode: 'hybrid',
    properties: ['path', 'fileType', 'tags', 'description'],
    vector: {
      value: vector,
      property: 'embeddings',
    },
    similarity: 0.8, // Adjust as needed
    limit,
    offset: limit * page,
  };
  if (typeFilter.length > 0) {
    options.where = { fileType: typeFilter };
  }

  return oramaSearch(db, options);
}

async function createDatabase() {
  db = create<typeof SearchSchema>({
    schema: SearchSchema,
    plugins: [pluginQPS() as any],
    id: 'Search Database',
  });
}

export function InitializeOrama() {}
