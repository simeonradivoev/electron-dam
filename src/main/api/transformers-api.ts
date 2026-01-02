import path from 'path';
import { env as transformersEnv } from '@huggingface/transformers';
import { app } from 'electron';
import { getAssetPath } from 'main/util';

function getModelsPath() {
  if (app.isPackaged) {
    // Production: models are in resources
    return path.join(process.resourcesPath, 'models');
  }

  return getAssetPath('models');
}

export default function InitializeTransformersApi() {
  // Get the correct path for models
  transformersEnv.cacheDir = getModelsPath();
  transformersEnv.localModelPath = getModelsPath();
  transformersEnv.allowRemoteModels = false;
}
