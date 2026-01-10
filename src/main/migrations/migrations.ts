import Store from 'electron-store';
import { RunnableMigration } from 'umzug';
import { StoreSchema } from '../../shared/constants';

interface Migration {
  since: string;
}

export interface MigrationContext {
  db: Loki;
  store: Store<StoreSchema>;
  dryRun: boolean;
  progress: (p: number) => void;
}

const ctx = require.context(
  './', // relative to this file
  false, // no subdirectories
  /\.ts$/, // only .ts files
);

export default ctx
  .keys()
  .filter((k) => !k.endsWith('migrations.ts') && k.startsWith('./'))
  .sort()
  .map((key) => {
    const mod = ctx(key) as RunnableMigration<MigrationContext> & Migration;

    return {
      name: key.replace('./', ''),
      path: key,
      up: mod.up,
      down: mod.down,
      since: mod.since,
    };
  });
