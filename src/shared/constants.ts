export enum FileType {
  Audio = 'Audio',
  Models = 'Models',
  Textures = 'Textures',
  Text = 'Text',
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
  Gif = '.gif',
  Svg = '.svg',
  Ico = '.ico',
  Apng = '.apng',
}
export enum TextFormat {
  Md = '.md',
}

export const FileTypeToFileFormats = {
  [FileType.Audio]: Object.values(AudioFileFormat),
  [FileType.Models]: Object.values(ModelFormat),
  [FileType.Textures]: Object.values(TextureFormat),
  [FileType.Text]: Object.values(TextFormat),
};

export const FileFormatsToFileTypes: Map<string, FileType> = new Map<
  string,
  FileType
>(
  Object.values(AudioFileFormat)
    .map((f) => [f as string, FileType.Audio] as [string, FileType])
    .concat(Object.values(ModelFormat).map((f) => [f, FileType.Models]))
    .concat(Object.values(TextureFormat).map((f) => [f, FileType.Textures]))
    .concat(Object.values(TextFormat).map((f) => [f, FileType.Text]))
);

export const supportedTypes = new Set<string>([
  ...Object.values(AudioFileFormat),
  ...Object.values(ModelFormat),
  ...Object.values(TextureFormat),
  ...Object.values(TextFormat),
]);

export const previewTypes: string[] = ['.png', '.jpg'];

export const ingoredFiles = new Set<string>([
  ...previewTypes.map((t) => `Preview${t}`),
  'Readme.md',
]);

export enum Channels {
  GetProjectDirectory = 'get-project-directory',
  GetGlobalTags = 'get-global-tags',
  FileTree = 'files-tree',
  UpdateTags = 'update-tags',
  GetTags = 'get-tags',
  GetParentTags = 'get-parent-tags',
  FileDetails = 'file-details',
  GetFileDetails = 'get-file-details',
  SelectProjectDirectory = 'select-project-directory',
  ProjectDirectorySelected = 'project-directory-selected',
  GetPreview = 'get-preview',
  CreateBundle = 'create-bundle',
  UpdateBundle = 'update-bundle',
  DeleteBundle = 'delete-bundle',
  ImportBundleMetadata = 'import-bundle-metadata',
  MinimizeWindow = 'minimize-window',
  MaximizeWindow = 'maximize-window',
  OpenPath = 'open-path',
  DownloadPreview = 'download-preview',
  GetBundles = 'get-bundles',
  GetBundle = 'get-bundle',
  CreateVirtualBundle = 'create-virtual-bundle',
  GetHomeBundle = 'get-home-bundles',
}
