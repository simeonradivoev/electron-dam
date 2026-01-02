import { existsSync } from 'fs';
import { stat } from 'fs/promises';
import path, { normalize } from 'path';
import log from 'electron-log';
import { getMetaId, operateOnMetadata } from 'main/api/file-system-api';
import { foreachAsync } from 'main/util';
import { BundleMetaFile } from 'shared/constants';
import { MigrationParams } from 'umzug';
import { MigrationContext } from './migrations';

export const since = '<1.0.0';

interface Metadata {
  path: string;
  tags: string[];
}

export async function up({ context }: MigrationParams<MigrationContext>) {
  const projectDir = normalize(context.store.get('projectDirectory'));
  const filesCollection = context.db.getCollection<Metadata>('files');
  if (filesCollection) {
    const files = filesCollection.find().filter((file) => {
      if (file.tags.length <= 0 || !file.path) {
        return false;
      }
      const absolutePath = normalize(file.path);
      if (absolutePath.startsWith(projectDir) && existsSync(absolutePath)) {
        return true;
      }
      return false;
    });

    await foreachAsync(files, async (file, index) => {
      let absolutePath = normalize(file.path);
      const fileStat = await stat(absolutePath);
      if (fileStat.isDirectory()) {
        absolutePath = path.join(absolutePath, BundleMetaFile);
      }
      operateOnMetadata<Tags>(
        { projectDir, path: absolutePath.substring(projectDir.length + 1) },
        async (meta) => {
          const tags = meta.tags ?? [];
          tags.push(...file.tags.filter((t) => !tags.includes(t)));
          meta.tags = tags;
          log.log(`Migrated meta for: ${absolutePath}`);
          return true;
        },
      );
      context.progress?.(index * (1 / files.length));
    });
  }

  context.db.removeCollection('files');
}
