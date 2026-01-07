import { FeatureExtractionPipeline, pipeline } from '@huggingface/transformers';
import { app } from 'electron';
import ElectronStore from 'electron-store';
import { StoreSchema } from 'shared/constants';
import { getSetting } from '../settings';

let extractor: any;
//private model = 'Xenova/all-MiniLM-L6-v2';
export const model = 'Xenova/gte-small';

export async function initialize(store: ElectronStore<StoreSchema>) {
  extractor = await pipeline('feature-extraction', model, {
    device: getSetting(store, 'embeddingDevice'),
    dtype: 'fp32',
    cache_dir: app.getPath('appData'),
  });
}

export async function generate(text: string): Promise<number[]> {
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return Array.from(output.data);
}
