import fs from 'fs';
import path from 'path';
import {
  create,
  insert,
  search,
  Results,
  update,
  getByID,
  OramaPlugin,
  count,
  remove,
  SearchParams,
} from '@orama/orama';
import { persist } from '@orama/plugin-data-persistence';
import { FileType } from 'shared/constants';
import { embeddingsService } from './EmbeddingsService';

export interface SearchSchema {
  filename: 'string';
  description: 'string';
  path: 'string';
  fileType: 'string';
  bundleId: 'string';
  embeddings?: 'vector[384]';
  tags?: 'string[]';
}

export interface IndexSchema {
  tags?: string[];
  description?: string;
  embeddings?: { data: number[] };
}

export class OramaManager {
  private db: any = null;

  private indexName = 'orama-index';

  private plugins: OramaPlugin[] = [];

  public async initialize() {
    await this.createDatabase();
  }

  public isEmpty(): boolean {
    return this.db ? count(this.db) <= 0 : true;
  }

  public async createDatabase() {
    const embeddings = 'vector[384]';

    this.db = create({
      schema: {
        filename: 'string',
        description: 'string',
        path: 'string',
        fileType: 'string',
        bundleId: 'string',
        tags: 'string[]',
        embeddings,
      },
      plugins: this.plugins,
    });
  }

  public async clearDatabase() {
    if (!this.db) return;
    console.log('Clearing Orama index by creating empty one...');
    await this.createDatabase();
  }

  public async persistIndex(destinationPath: string) {
    if (!this.db) return;
    const data = await persist(this.db, 'dpack');
    try {
      await fs.promises.writeFile(
        path.join(destinationPath, `${this.indexName}.dpack`),
        data as unknown as string,
      );
      console.log('Orama index saved to disk');
    } catch (error) {
      console.error('Could not save orama index to disk');
      console.error(error);
    }
  }

  public async destroyPreviousIndex(destinationPath: string) {
    if (!this.db) return;
    await fs.promises.rm(path.join(destinationPath, `${this.indexName}.dpack`));
    console.log('Removed previous Orama index from disk');
  }

  public async removeFile(file: FilePath) {
    if (!this.db) return;
    await remove(this.db, file.path);
  }

  public async indexFile(file: FileInfo, meta?: IndexSchema | null) {
    if (!this.db) return;

    const existing = getByID(this.db, file.path);
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
      await update(this.db, file.path, entry);
    } else {
      await insert(this.db, entry);
    }
  }

  public async search(
    query: string,
    typeFilter: FileType[],
    page: number,
  ): Promise<Results<SearchEntrySchema>> {
    if (!this.db) {
      throw new Error('Orama DB not initialized');
    }

    // Generate embedding for the query
    const vector = await embeddingsService.generate(query);

    const options: SearchParams<any, SearchEntrySchema> = {
      term: query,
      mode: 'hybrid',
      properties: ['path', 'fileType', 'tags', 'description'],
      vector: {
        value: vector,
        property: 'embeddings',
      },
      similarity: 0.8, // Adjust as needed
      limit: 20,
      offset: 20 * page,
    };
    if (typeFilter.length > 0) {
      options.where = { fileType: typeFilter };
    }

    return search(this.db, options);
  }
}

export const oramaManager = new OramaManager();
