import fs from 'fs';
import path from 'path';
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
} from '@orama/orama';
import { persist } from '@orama/plugin-data-persistence';
import { pluginQPS } from '@orama/plugin-qps';
import log from 'electron-log/main';
import Store from 'electron-store';
import { FilePath } from 'main/util';
import { FileType, StoreSchema } from '../../../shared/constants';
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

async function persistIndex(destinationPath: string) {
  const data = await persist(db, 'dpack');
  try {
    await fs.promises.writeFile(
      path.join(destinationPath, `${indexName}.dpack`),
      data as unknown as string,
    );
    log.log('Orama index saved to disk');
  } catch (error) {
    log.error('Could not save orama index to disk');
    log.error(error);
  }
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
  store: Store<StoreSchema>,
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
