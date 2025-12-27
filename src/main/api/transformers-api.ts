import { env as transformersEnv } from '@huggingface/transformers';
import { app } from 'electron';
import path from 'path';

function getModelsPath() {
  if (app.isPackaged) {
    // Production: models are in resources
    return path.join(process.resourcesPath, 'models');
  }

  return path.join(app.getAppPath(), 'assets', 'models');
}

export default function InitializeTransformersApi() {
  // Get the correct path for models
  transformersEnv.cacheDir = getModelsPath();
  transformersEnv.localModelPath = getModelsPath();
  transformersEnv.allowRemoteModels = false;
}
