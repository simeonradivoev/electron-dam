import z from 'zod/v3';

export enum FileType {
  Audio = 'Audio',
  Models = 'Models',
  Textures = 'Textures',
  Text = 'Text',
  Bundle = 'Bundle',
}

export enum AudioFileFormat {
  Mp3 = '.mp3',
  Wav = '.wav',
  Ogg = '.ogg',
  Flac = '.flac',
}

export enum ModelFormat {
  Obj = '.obj',
  Fbx = '.fbx',
  Glb = '.glb',
  GLTF = '.gltf',
  Stl = '.stl',
}

export enum ImageFormat {
  Png = '.png',
  Jpg = '.jpg',
  Jpeg = '.jpeg',
  Gif = '.gif',
  Svg = '.svg',
  Ico = '.ico',
  Apng = '.apng',
  WebP = '.webp',
  Bmp = '.bmp',
}

export enum TextFormat {
  Md = '.md',
}

export enum LoginProvider {
  Humble = 'humble',
}

export const zipDelimiter = `.zip`;

export const MetaFileExtension = 'dam';
export const MetaFileExtensionWithDot = `.${MetaFileExtension}`;
export const BundleMetaFile = 'bundle.json';

export const FileTypeToFileFormats = {
  [FileType.Audio]: Object.values(AudioFileFormat),
  [FileType.Models]: Object.values(ModelFormat),
  [FileType.Textures]: Object.values(ImageFormat),
  [FileType.Text]: Object.values(TextFormat),
};

export const FileFormatsToFileTypes: Map<string, FileType> = new Map<string, FileType>(
  Object.values(AudioFileFormat)
    .map((f) => [f as string, FileType.Audio] as [string, FileType])
    .concat(Object.values(ModelFormat).map((f) => [f, FileType.Models]))
    .concat(Object.values(ImageFormat).map((f) => [f, FileType.Textures]))
    .concat(Object.values(TextFormat).map((f) => [f, FileType.Text]))
    .concat([[`.${BundleMetaFile}`, FileType.Bundle]]),
);

export const supportedTypesFlat = [
  ...Object.values(AudioFileFormat),
  ...Object.values(ModelFormat),
  ...Object.values(ImageFormat),
  ...Object.values(TextFormat),
  '.zip',
];
export const supportedTypes = new Set<string>(supportedTypesFlat);

export const previewTypes: string[] = ['.webp', '.png', '.jpg', '.gif', '.jpeg'];

export type ChannelGetter<TReturn, TArgs extends unknown[] = unknown[]> = {
  renderer: (...args: TArgs) => Promise<TReturn>;
  main: (...args: TArgs) => Promise<TReturn>;
};

export type ChannelSub<TArgs extends unknown[] = unknown[]> = {
  renderer: (func: (...eventArg: TArgs) => void) => () => void;
  main: (...args: TArgs) => void;
};

export const channelsSchema = {
  get: {
    getProjectDirectory: {} as ChannelGetter<string | null>,
    getGlobalTags: {} as ChannelGetter<{ tags: GlobalTagEntry[]; count: number }, [limit?: number]>,
    getAllFiles: {} as ChannelGetter<FileTreeNode[], [path: string]>,
    getFile: {} as ChannelGetter<FileTreeNode | null, [path: string]>,
    getFileChildrenPaths: {} as ChannelGetter<string[], [path: string]>,
    getFileChildren: {} as ChannelGetter<FileTreeNode[], [path: string]>,
    addTags: {} as ChannelGetter<string[] | null, [path: string, tags: string[]]>,
    removeTag: {} as ChannelGetter<string[] | null, [path: string, tag: string]>,
    removeAllTags: {} as ChannelGetter<void, [path: string]>,
    autoMetadata: {} as ChannelGetter<
      void,
      [path: string, type: AutoTagType, missingOnly: boolean]
    >,
    canGenerateMetadata: {} as ChannelGetter<boolean, [path: string, type: AutoTagType]>,
    saveAudioPreview: {} as ChannelGetter<void, [path: string, blob: string]>,
    getTags: {} as ChannelGetter<string[], [path: string]>,
    setTags: {} as ChannelGetter<string[] | null, [path: string, tags: string[]]>,
    getParentTags: {} as ChannelGetter<string[], [path: string]>,
    getMetadata: {} as ChannelGetter<AnyMetadata | null, [path: string]>,
    getFileDetails: {} as ChannelGetter<FileInfo | null, [path: string]>,
    selectProjectDirectory: {} as ChannelGetter<string | null>,
    createBundle: {} as ChannelGetter<boolean, [directory: string]>,
    updateBundle: {} as ChannelGetter<Bundle | null, [path: string, bundle: Bundle]>,
    deleteBundle: {} as ChannelGetter<void, [path: string]>,
    importBundleMetadata: {} as ChannelGetter<BundleMetadata, [url: string, type: ImportType]>,
    canImportBundleMetadata: {} as ChannelGetter<boolean, [url: string, type: ImportType]>,
    downloadPreview: {} as ChannelGetter<
      void,
      [bundlePath: string, url: string | Uint8Array<ArrayBuffer>]
    >,
    minimizeWindow: {} as ChannelGetter<void>,
    maximizeWindow: {} as ChannelGetter<void>,
    openPath: {} as ChannelGetter<void, [path: string]>,
    getBundles: {} as ChannelGetter<BundleInfo[]>,
    getBundle: {} as ChannelGetter<BundleInfo | null, [id: string]>,
    getBundleForAsset: {} as ChannelGetter<BundleInfo | null, [path: string]>,
    createVirtualBundle: {} as ChannelGetter<VirtualBundle | undefined, [bundle: VirtualBundle]>,
    getHomeBundles: {} as ChannelGetter<HomePageBundles | undefined>,
    convertBundleToLocal: {} as ChannelGetter<boolean, [id: string]>,
    downloadBundle: {} as ChannelGetter<void, [id: string, extract: boolean]>,
    moveBundle: {} as ChannelGetter<boolean, [oldPath: string, newPath: string]>,
    search: {} as ChannelGetter<
      { nodes: SearchEntryResult[]; count: number; pageSize: number },
      [query: string, typesFilter: FileType[], page: number]
    >,
    getTasks: {} as ChannelGetter<TaskMetadata[]>,
    reIndexFiles: {} as ChannelGetter<void>,
    generateEmbeddings: {} as ChannelGetter<void, [path: string]>,
    generateMissingEmbeddings: {} as ChannelGetter<void>,
    canGenerateEmbeddings: {} as ChannelGetter<boolean, [path: string]>,
    getSetting: {} as ChannelGetter<unknown, [key: keyof typeof Options]>,
    getSettings: {} as ChannelGetter<{ [key: string]: unknown }, [category: OptionCategory]>,
    getDefaultSettingValue: {} as ChannelGetter<unknown, [key: keyof typeof Options]>,
    setSetting: {} as ChannelGetter<unknown, [key: keyof typeof Options, value: unknown]>,
    setSettings: {} as ChannelGetter<void, [settings: OptionDefaultValuesOptional]>,
    cancelTask: {} as ChannelGetter<void, [id: string]>,
    exportBundle: {} as ChannelGetter<void, [path: string]>,
    getVersion: {} as ChannelGetter<VersionMetadata>,
    openSystemPath: {} as ChannelGetter<void, [pathType: 'log' | 'user' | 'project']>,
    saveAudioPeaks: {} as ChannelGetter<void, [path: string, peaks: string]>,
    removeDescription: {} as ChannelGetter<void, [path: string]>,
    getCacheSize: {} as ChannelGetter<number>,
    getHasUpdate: {} as ChannelGetter<VersionCheck | null>,
    updateAndRestart: {} as ChannelGetter<void>,
    login: {} as ChannelGetter<void, [provider: LoginProvider]>,
    logout: {} as ChannelGetter<void, [provider: LoginProvider]>,
    checkLogin: {} as ChannelGetter<boolean, [provider: LoginProvider]>,
    importBundles: {} as ChannelGetter<void, [provider: LoginProvider]>,
  },
  on: {
    fileAdded: {} as ChannelSub<[path: string]>,
    fileChanged: {} as ChannelSub<[path: string]>,
    fileUnlinked: {} as ChannelSub<[path: string]>,
    folderAdded: {} as ChannelSub<[path: string]>,
    folderUnlinked: {} as ChannelSub<[path: string]>,
    onTasksUpdate: {} as ChannelSub<[updateType: TaskUpdateType, tasks: TaskMetadata[]]>,
    onUpdateNotification: {} as ChannelSub<[info: VersionCheck]>,
  },
};

export type ChannelsSchema = typeof channelsSchema;

export type RendererIpcGetters = {
  [K in keyof ChannelsSchema['get']]: ChannelsSchema['get'][K]['renderer'];
};

export type RendererIpcCallbacks = {
  [K in keyof ChannelsSchema['on']]: ChannelsSchema['on'][K]['renderer'];
};

export type MainIpcGetter = {
  [K in keyof ChannelsSchema['get']]: ChannelsSchema['get'][K]['main'];
};

export type MainIpcCallbacks = {
  [K in keyof ChannelsSchema['on']]: ChannelsSchema['on'][K]['main'];
};

export enum TaskUpdateType {
  Update = 'update',
  Structure = 'structure',
  Ended = 'ended',
  Added = 'added',
}

export enum AutoTagType {
  Transformers = 'transformers',
  Ollama = 'ollama',
}

export enum ImportType {
  OpenGraph = 'open-graph',
  Ollama = 'ollama',
}

export enum OptionCategory {
  General = 'general',
  Metadata = 'metadata',
  Debug = 'debug',
}

export type OptionType = {
  label: string;
  subLabel?: string;
  description?: string;
  schema: z.ZodTypeAny;
  type: 'string' | 'number' | 'bool' | 'enum';
  category: OptionCategory;
  default?: string | number | boolean;
  options?: string[];
  hintValue?: string;
  localType?: 'local' | 'session';
  min?: number;
  max?: number;
  stepSize?: number;
  instant?: boolean;
};

export type OptionsType = {
  [K: string]: OptionType;
};

export type OptionDefaultValues = {
  [K in keyof typeof Options]: z.infer<(typeof Options)[K]['schema']>;
};

export type OptionDefaultValuesOptional = {
  [K in keyof typeof Options]?: z.infer<(typeof Options)[K]['schema']>;
};

export type OptionRemoteValidators = {
  [K in keyof typeof Options as (typeof Options)[K] extends { isLocal: true }
    ? never
    : K]: (typeof Options)[K]['schema'];
};

export const Options = {
  darkMode: {
    label: 'Dark Mode',
    subLabel: 'Dark Mode',
    type: 'bool',
    schema: z.boolean().default(false),
    category: OptionCategory.General,
    localType: 'local',
    instant: true,
  },
  ollamaHost: {
    label: 'Ollama Host',
    schema: z
      .string()
      .url()
      .default(() => 'http://127.0.0.1:11434'),
    type: 'string',
    category: OptionCategory.Metadata,
  },
  ollamaModel: {
    label: 'Ollama Model',
    schema: z.string().default('gemma3'),
    type: 'string',
    category: OptionCategory.Metadata,
  },
  searchResultsPerPage: {
    label: 'Search Results per Page',
    schema: z.number().min(1).default(20),
    type: 'number',
    category: OptionCategory.General,
    min: 1,
    stepSize: 1,
  },
  cachedStorageSize: {
    label: 'Cached Storage Size MB',
    description:
      'The max amount of storage the cache can use in Megabytes.\nWhen reached, older metadata will be deleted.',
    schema: z.number().min(16).default(128),
    type: 'number',
    category: OptionCategory.General,
    stepSize: 16,
    min: 16,
  },
  embeddingDevice: {
    label: 'Embedding Device',
    description: 'What device should we use for enbedding generation',
    schema: z.enum(['gpu', 'cpu', 'webgpu', 'wasm', 'auto', 'cuda']).default('gpu'),
    options: ['gpu', 'cpu', 'webgpu', 'wasm', 'auto', 'cuda'],
    type: 'enum',
    category: OptionCategory.Metadata,
  },
} satisfies OptionsType;

export interface GetOption {
  <K extends keyof typeof Options>(key: K): (typeof Options)[K];
  (key: string): OptionType;
}

export const getOption: GetOption = (key: string): OptionType => {
  if (key in Options) {
    return Options[key as keyof typeof Options];
  }
  throw new Error(`No Option found ${key}`);
};

// Builds validators for options in the given category
export const BuildOptionValidators = (category: OptionCategory, includeLocal?: boolean) =>
  Object.fromEntries(
    Object.keys(Options)
      .map((key) => ({ key, option: Options[key as keyof typeof Options] as OptionType }))
      .filter(({ option }) => option.category === category && (includeLocal || !option.localType))
      .map(({ key, option }) => [key, option.schema]),
  ) as { [K in keyof typeof Options]: z.ZodTypeAny };

export type StoreSchema = z.infer<typeof StoreSchemaZod>;

export const StoreSchemaZod = z
  .object({
    projectDirectory: z.string().default(''),
    windowSize: z
      .object({
        width: z.number(),
        height: z.number(),
      })
      .optional(),
    windowPosition: z
      .object({
        x: z.number().optional(),
        y: z.number().optional(),
      })
      .optional(),
  })
  .extend(
    Object.fromEntries(
      Object.keys(Options)
        .map((key) => ({ key, option: Options[key as keyof typeof Options] }))
        .filter(({ option }) => {
          if ((option as OptionType).localType) return false;
          return true;
        })
        .map(({ key, option }) => [key, option.schema]),
    ) as OptionRemoteValidators,
  );

export const HUMBLE_PARTITION = 'persist:humble';
