import React, { createContext } from 'react';
import { TreeNodeInfo } from '@blueprintjs/core';
import { UseQueryResult } from '@tanstack/react-query';
import { IDBPDatabase } from 'idb/with-async-ittr';
import { FileType } from 'shared/constants';

export interface AppContextSchema {
  files: UseQueryResult<TreeNodeInfo<FileTreeNode>[], unknown>;
  setSelected: (id: string | number, selected: boolean) => void;
  setExpanded: (nodePath: NodePath, expanded: boolean) => void;
  tags: UseQueryResult<string[], unknown>;
  typeFilter: FileType[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  toggleType: (type: FileType) => void;
  filter: string | undefined;
  setFilter: (filter: string | undefined) => void;
  sideBarSize: number;
  database: IDBPDatabase<FilesDB> | undefined;
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
  setSideBarSize: (size: number) => void;
  setFileInfo: (fileInfo: FileInfo | null) => void;
  fileInfo: FileInfo | null;
}

export const AppContext = createContext({} as AppContextSchema);
