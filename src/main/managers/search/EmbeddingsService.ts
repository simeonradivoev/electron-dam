import { pipeline, PipelineType } from '@huggingface/transformers';
import { app } from 'electron';

class EmbeddingsService {
  private extractor: any;
  //private model = 'Xenova/all-MiniLM-L6-v2';
  public readonly model = 'Xenova/gte-small';

  async initialize() {
    if (!this.extractor) {
      // Use a runtime import wrapper so the TypeScript/CommonJS downlevel
      // doesn't transform `import()` into `require()` (which fails for ESM-only packages).
      this.extractor = await pipeline('feature-extraction', this.model, {
        device: 'cpu',
        dtype: 'fp32',
        cache_dir: app.getPath('appData'),
      });
    }
  }

  async generate(text: string): Promise<number[]> {
    if (!this.extractor) {
      await this.initialize();
    }
    const output = await this.extractor(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data);
  }
}

export const embeddingsService = new EmbeddingsService();
