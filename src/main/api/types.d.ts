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
      bundle: Bundle;
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
  type FileMetadata = {
    path: string;
    tags: string[];
  };
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
    description?: string;
    keywords?: string[];
  }
}
