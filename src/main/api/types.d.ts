import { UpdateInfo } from 'electron-updater';
import { DBSchema } from 'idb';
import { IAudioMetadata } from 'music-metadata';
import { FileType } from 'shared/constants';
import { IndexSchema } from './search/Orama';

declare global {
  interface FileTreeNode {
    isDirectory: boolean;
    isEmpty: boolean;
    bundlePath?: string;
    name: string;
    path: string;
    fileType?: FileType;
    stats: {
      size: number;
      ino: number;
      mtimeMs: number;
    };
    isArchived: boolean;
  }

  interface GlobalTagEntry {
    tag: string;
    count: number;
  }

  interface FileInfo {
    size: number;
    name: string;
    path: string;
    fileExt: string;
    fileType?: FileType;
    directory: string;
    hasMaterialLibrary: boolean;
    hasThumbnail: boolean;
    audioMetadata?: { peaks?: string } & IAudioMetadata;
    modelData?: Uint8Array;
    isDirectory: boolean;
    isZip?: boolean;
    previewPath?: string;
    bundlePath?: string;
    bundle?: {
      name: string;
      isParentBundle: boolean;
      bundle: BundleInfo;
    };
    readme?: string;
  }
  interface Bundle extends Tags, Description {
    sourceUrl?: string | undefined;
    licenseType?: string | undefined;
  }
  interface FileContents {
    info: FileInfo;
    contents: any;
  }
  interface Tags {
    tags?: string[];
  }
  interface Description {
    description?: string;
  }
  interface VersionMetadata {
    version: string;
  }
  interface FileMetadata extends Tags, Description {
    embeddings?: {
      model: string;
      data: number[];
      hash: string;
    };
  }
  interface AudioMetadata extends FileMetadata {
    lastModified?: number;
    peaks?: string;
  }
  interface VirtualBundle extends Bundle {
    id: string;
    previewUrl?: string | undefined;
    name: string;
    date: Date;
    // The source ID to look up downloads and other metadata from the source, like say Humble Bundle
    sourceId?: string;
    sourceType?: string;
  }
  interface BundleInfo {
    name: string;
    id: string;
    previewUrl?: string;
    isVirtual: boolean;
    sourceType?: string;
    bundle: Bundle;
    date: Date;
  }
  interface HomePageStats {
    bundleCount: number;
    virtualBundleCount: number;
    assetCount: number;
    assetsSize: number;
    missingBundlesCount: number;
    missingMetadataCount: number;
    missingEmbeddingsCount: number;
  }
  interface HomePageBundles {
    random: BundleInfo[];
    recent: BundleInfo[];
    stats: HomePageStats;
  }
  type FileDBValue = {
    selected: boolean | undefined;
    expanded: boolean | undefined;
    tags: string[] | undefined;
  };

  interface QueryDatabase extends DBSchema {
    queries: {
      key: string;
      value: string;
    };
  }

  interface FilesDB extends DBSchema {
    selected: {
      value: boolean;
      key: string;
    };
    expanded: {
      value: boolean;
      key: string;
    };
  }

  type TagInfo = {
    tag: string;
    isFromParent: boolean;
  };

  interface BundleMetadata {
    title?: string;
    description?: string;
    tags?: string[];
    preview?: string;
  }

  interface SearchEntrySchema {
    id: string;
    filename: string;
    description: string;
    path: string;
    isArchived: boolean;
    tags?: string[];
    fileType?: FileType | undefined;
    bundleId?: string;
    embeddings?: number[];
    isVirtual: boolean;
    virtualPreview?: string;
  }

  interface SearchEntryResult extends SearchEntrySchema {
    score: number;
  }

  export interface Task extends TaskMetadata {
    abortController?: AbortController;
    userData?: any;
  }

  export interface TaskMetadata {
    id: string;
    label: string;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
    progress?: number;
    error?: string;
    options: { blocking?: boolean; silent?: boolean; icon?: string };
    userData?: any;
  }

  interface NodeRequire {
    context(
      path: string,
      deep?: boolean,
      filter?: RegExp,
    ): {
      keys(): string[];
      <T>(id: string): T;
    };
  }

  type AnyMetadata = FileMetadata & Tags & Description & IndexSchema & Bundle & AudioMetadata;

  type ProgressReporter = (progress: number) => void;

  interface FileLoaderRegistry {
    registerPre: (...indexers: FileIndexingHandler[]) => void;
    register: (...indexers: FileIndexingHandler[]) => void;
    index: (abort: AbortSignal, progress: ProgressReporter) => Promise<void>;
  }

  type FileIndexingHandler = (
    params: FileIndexerParams,
  ) => Promise<((node: FileTreeNode) => Promise<any>) | void>;

  export interface FileIndexerParams {
    projectDir: string;
    abort: AbortSignal;
  }

  export interface VersionCheck {
    info: UpdateInfo;
    isUpdateAvailable: boolean;
  }

  export interface BundleImporter {
    import: (abort?: AbortSignal, progress?: ProgressReporter) => Promise<void>;
    isLoggedIn: () => Promise<boolean>;
    login: () => Promise<void>;
  }
}
