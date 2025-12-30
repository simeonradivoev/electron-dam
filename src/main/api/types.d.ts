import { DBSchema } from 'idb';
import { IAudioMetadata } from 'music-metadata';
import { FileType } from 'shared/constants';

declare global {
  interface FileTreeNode {
    isDirectory: boolean;
    isEmpty: boolean;
    bundlePath?: string;
    name: string;
    path: string;
    children?: FileTreeNode[];
    fileType?: FileType;
    size: number;
    isArchived: boolean;
  }

  interface GlobalTagEntry {
    tag: string;
    count: number;
  }

  interface SearchTreeNode extends FileTreeNode {
    score: number;
    tags?: string[];
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
  }
  interface BundleInfo {
    name: string;
    id: string;
    previewUrl?: string;
    isVirtual: boolean;
    bundle: Bundle;
    date: Date;
  }
  interface HomePageStats {
    bundleCount: number;
    virtualBundleCount: number;
    assetCount: number;
    assetsSize: number;
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

  interface FilePath {
    path: string;
    projectDir: string;
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
    tags?: string[];
    fileType?: FileType | undefined;
    bundleId?: string;
    embeddings?: number[];
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
  }
}
