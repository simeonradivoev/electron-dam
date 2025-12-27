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

export enum TextureFormat {
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

export const zipDelimiter = `.zip`;

export type StoreSchema = z.infer<typeof StoreSchemaZod>;
z.object({
  call: z.function().parameters(),
});

export const StoreSchemaZod = z.object({
  projectDirectory: z.string(),
  windowSize: z.object({
    width: z.number(),
    height: z.number(),
  }),
  windowPosition: z.object({
    x: z.number().optional(),
    y: z.number().optional(),
  }),
});

export const MetaFileExtension = 'dam';
export const MetaFileExtensionWithDot = `.${MetaFileExtension}`;
export const BundleMetaFile = 'bundle.json';

export const FileTypeToFileFormats = {
  [FileType.Audio]: Object.values(AudioFileFormat),
  [FileType.Models]: Object.values(ModelFormat),
  [FileType.Textures]: Object.values(TextureFormat),
  [FileType.Text]: Object.values(TextFormat),
};

export const FileFormatsToFileTypes: Map<string, FileType> = new Map<string, FileType>(
  Object.values(AudioFileFormat)
    .map((f) => [f as string, FileType.Audio] as [string, FileType])
    .concat(Object.values(ModelFormat).map((f) => [f, FileType.Models]))
    .concat(Object.values(TextureFormat).map((f) => [f, FileType.Textures]))
    .concat(Object.values(TextFormat).map((f) => [f, FileType.Text]))
    .concat([[`.${BundleMetaFile}`, FileType.Bundle]]),
);

export const supportedTypesFlat = [
  ...Object.values(AudioFileFormat),
  ...Object.values(ModelFormat),
  ...Object.values(TextureFormat),
  ...Object.values(TextFormat),
  '.zip',
];
export const supportedTypes = new Set<string>(supportedTypesFlat);

export const previewTypes: string[] = ['.webp', '.png', '.jpg', '.gif', '.jpeg'];

export type OnEventTypes = {
  [Channels.FileAdded]: [path: string];
  [Channels.FolderAdded]: [path: string];
  [Channels.FileUnlinked]: [path: string];
  [Channels.FolderUnlinked]: [path: string];
  [Channels.FileChanged]: [path: string];
};

export type ChannelGetter<TReturn, TArgs extends any[] = any[]> = {
  renderer: (...args: TArgs) => Promise<TReturn>;
  main: (...args: TArgs) => Promise<TReturn>;
};

export type ChannelSub<TArgs extends any[] = any[]> = {
  renderer: (func: (...eventArg: TArgs) => void) => () => void;
  main: (...args: TArgs) => void;
};

export const channelsSchema = {
  get: {
    getProjectDirectory: {} as ChannelGetter<string | null>,
    getGlobalTags: {} as ChannelGetter<GlobalTagEntry[], [limit?: number]>,
    getAllFiles: {} as ChannelGetter<FileTreeNode[], [path: string]>,
    getFile: {} as ChannelGetter<FileTreeNode | null, [path: string]>,
    getFileChildrenPaths: {} as ChannelGetter<string[], [path: string]>,
    getFileChildren: {} as ChannelGetter<FileTreeNode[], [path: string]>,
    addTags: {} as ChannelGetter<string[] | null, [path: string, tags: string[]]>,
    removeTag: {} as ChannelGetter<string[] | null, [path: string, tag: string]>,
    autoMetadata: {} as ChannelGetter<FileMetadata | null, [path: string, type: AutoTagType]>,
    getTags: {} as ChannelGetter<string[], [path: string]>,
    setTags: {} as ChannelGetter<string[] | null, [path: string, tags: string[]]>,
    getParentTags: {} as ChannelGetter<string[], [path: string]>,
    getMetadata: {} as ChannelGetter<FileMetadata | null, [path: string]>,
    getFileDetails: {} as ChannelGetter<FileInfo | null, [path: string]>,
    selectProjectDirectory: {} as ChannelGetter<string | null>,
    createBundle: {} as ChannelGetter<boolean, [directory: string]>,
    updateBundle: {} as ChannelGetter<Bundle | null, [path: string, bundle: Bundle]>,
    deleteBundle: {} as ChannelGetter<void, [path: string]>,
    importBundleMetadata: {} as ChannelGetter<BundleMetadata, [url: string, type: ImportType]>,
    downloadPreview: {} as ChannelGetter<void, [bundlePath: string, url: string]>,
    minimizeWindow: {} as ChannelGetter<void>,
    maximizeWindow: {} as ChannelGetter<void>,
    openPath: {} as ChannelGetter<void, [path: string]>,
    getBundles: {} as ChannelGetter<BundleInfo[]>,
    getBundle: {} as ChannelGetter<BundleInfo | null, [id: string]>,
    createVirtualBundle: {} as ChannelGetter<VirtualBundle | undefined, [bundle: VirtualBundle]>,
    getHomeBundles: {} as ChannelGetter<HomePageBundles | undefined>,
    convertBundleToLocal: {} as ChannelGetter<boolean, [id: string]>,
    moveBundle: {} as ChannelGetter<boolean, [oldPath: string, newPath: string]>,
    search: {} as ChannelGetter<
      { nodes: SearchTreeNode[]; count: number },
      [query: string, typesFilter: FileType[], page: number]
    >,
    getTasks: {} as ChannelGetter<TaskMetadata[]>,
    reIndexDatabaseSearch: {} as ChannelGetter<void>,
    generateEmbeddings: {} as ChannelGetter<FileMetadata, [path: string]>,
    generateMissingEmbeddings: {} as ChannelGetter<void>,
    getSetting: {} as ChannelGetter<any, [key: keyof StoreSchema]>,
    setSetting: {} as ChannelGetter<
      any,
      [key: keyof StoreSchema, value: StoreSchema[keyof StoreSchema]]
    >,
    cancelTask: {} as ChannelGetter<void, [id: string]>,
    exportBundle: {} as ChannelGetter<void, [path: string]>,
    getVersion: {} as ChannelGetter<VersionMetadata>,
  },
  on: {
    fileAdded: {} as ChannelSub<[path: string]>,
    fileChanged: {} as ChannelSub<[path: string]>,
    fileUnlinked: {} as ChannelSub<[path: string]>,
    folderAdded: {} as ChannelSub<[path: string]>,
    folderUnlinked: {} as ChannelSub<[path: string]>,
    onTasksUpdate: {} as ChannelSub<[tasks: TaskMetadata[]]>,
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

export enum Channels {
  GetProjectDirectory = 'getProjectDirectory',
  GetGlobalTags = 'getGlobalTags',
  GetAllFiles = 'getAllFiles',
  SetTags = 'setTags',
  AutoMetadata = 'autoMetadata',
  GetTags = 'getTags',
  AddTags = 'add-tags',
  RemoveTag = 'remove-tag',
  GetParentTags = 'get-parent-tags',
  FileDetails = 'file-details',
  GetFileDetails = 'get-file-details',
  SelectProjectDirectory = 'select-project-directory',
  GetPreview = 'get-preview',
  CreateBundle = 'create-bundle',
  UpdateBundle = 'update-bundle',
  DeleteBundle = 'delete-bundle',
  ImportBundleMetadata = 'import-bundle-metadata',
  MinimizeWindow = 'minimizeWindow',
  MaximizeWindow = 'maximizeWindow',
  OpenPath = 'open-path',
  DownloadPreview = 'download-preview',
  GetBundles = 'get-bundles',
  GetBundle = 'get-bundle',
  CreateVirtualBundle = 'create-virtual-bundle',
  GetHomeBundle = 'get-home-bundles',
  ConvertBundleToLocal = 'convert-bundle-to-local',
  MoveBundle = 'move-bundle',
  SetSearch = 'set-search',
  TaskUpdated = 'task-updated',
  TaskAdded = 'task-added',
  TaskCompleted = 'task-completed',
  GetTasks = 'get-tasks',
  CancelTask = 'cancel-task',
  ReSearchIndexFiles = 're-search-index-files',
  GetMetadata = 'get-metadata',
  GenerateEmbeddings = 'generate-embeddings',
  GenerateMissingEmbeddings = 'generate-missing-embeddings',
  GetFile = 'get-file',
  GetFileChildrenPaths = 'get-file-children-paths',
  GetFileChildren = 'get-file-children',
  FileAdded = 'file-added',
  FolderAdded = 'folder-added',
  FileUnlinked = 'file-unlinked',
  FolderUnlinked = 'folder-unlinked',
  FileChanged = 'file-changed',
  GetSetting = 'get-setting',
  SetSetting = 'set-setting',
}

export enum AutoTagType {
  Transformers = 'transformers',
  Ollama = 'ollama',
}

export enum ImportType {
  OpenGraph = 'open-graph',
  Ollama = 'ollama',
}
