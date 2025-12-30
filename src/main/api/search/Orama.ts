import fs from 'fs';
import path from 'path';
import {
  create,
  insert,
  search as oramaSearch,
  Results,
  update,
  getByID,
  OramaPlugin,
  count,
  remove,
  SearchParams,
  AnySchema,
} from '@orama/orama';
import { persist } from '@orama/plugin-data-persistence';
import Store from 'electron-store';
import { FileType, Options, StoreSchema } from '../../../shared/constants';
import { getSetting } from '../settings';
import { embeddingsService } from './EmbeddingsService';

const SearchSchema: AnySchema = {
  filename: 'string',
  description: 'string',
  path: 'string',
  fileType: 'string',
  bundleId: 'string',
  embeddings: 'vector[384]',
  tags: 'string[]',
};

export interface IndexSchema {
  tags?: string[];
  description?: string;
  embeddings?: { data: number[] };
}

let db: any = null;
const indexName = 'orama-index';
const plugins: OramaPlugin[] = [];

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
    console.log('Orama index saved to disk');
  } catch (error) {
    console.error('Could not save orama index to disk');
    console.error(error);
  }
}

export async function clearDatabase() {
  console.log('Clearing Orama index by creating empty one...');
  await createDatabase();
}

async function destroyPreviousIndex(destinationPath: string) {
  await fs.promises.rm(path.join(destinationPath, `${indexName}.dpack`));
  console.log('Removed previous Orama index from disk');
}

export async function removeFile(file: FilePath) {
  await remove(db, file.path);
}

export async function indexFile(file: FileInfo, meta?: IndexSchema | null) {
  const existing = getByID(db, file.path);
  const bundleDescription = file.bundle?.bundle.bundle.description || '';
  const entry: SearchEntrySchema = {
    id: file.path,
    filename: file.name,
    description: meta?.description ?? bundleDescription,
    path: file.path,
    fileType: file.fileType,
    tags: meta?.tags,
    bundleId: file.bundle?.bundle.id || '',
    embeddings: meta?.embeddings?.data,
  };
  if (existing) {
    await update(db, file.path, entry);
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
  const vector = await embeddingsService.generate(query);
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
  db = create({
    schema: SearchSchema,
    plugins,
  });
}

export function InitializeOrama() {}
