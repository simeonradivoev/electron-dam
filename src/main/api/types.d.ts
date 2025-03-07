import { DBSchema } from 'idb';
import { FileType } from 'shared/constants';

declare global {
  interface FileTreeNode {
    isDirectory: boolean;
    name: string;
    path: string;
    children: FileTreeNode[];
    tags: string[];
    fileType?: FileType | undefined;
    readmePath?: string;
    previewPath?: string;
    bundlePath?: string;
    size: number;
  }
  interface FileInfo {
    size: number;
    name: string;
    path: string;
    relativePathStart: number;
    fileExt: string;
    directory: string;
    hasMaterialLibrary: boolean;
    modelData?: Uint8Array;
    isDirectory: boolean;
    previewPath?: string;
    bundle?: {
      name: string;
      isParentBundle: boolean;
      bundle: BundleInfo;
    };
    readme?: string;
  }
  interface Bundle {
    description?: string;
    sourceUrl?: string | undefined;
    licenseType?: string | undefined;
  }
  interface FileContents {
    info: FileInfo;
    contents: any;
  }
  interface FileMetadata {
    path: string;
    tags: string[];
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

  interface StoreSchema {
    projectDirectory: string;
    windowSize: {
      width: number;
      height: number;
    };
    windowPosition: {
      x?: number;
      y?: number;
    };
  }

  interface BundleMetadata {
    title?: string;
    description?: string;
    keywords?: string[];
    preview?: string;
  }
}
