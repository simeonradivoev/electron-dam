import { QueryClient } from '@tanstack/react-query';
import { IDBPDatabase } from 'idb';
import update from 'immutability-helper';
import { FileType } from 'shared/constants';

export const ToggleTag = (
  queryClient: QueryClient,
  database: IDBPDatabase<FilesDB> | undefined,
  tag: string,
  selectedTags: string[],
  setSelectedTags: (tags: string[]) => void
) => {
  const index = selectedTags.indexOf(tag);

  let newTags: string[];
  if (index >= 0) {
    newTags = update(selectedTags, { $splice: [[index, 1]] });
  } else {
    newTags = update(selectedTags, { $push: [tag] });
  }

  setSelectedTags(newTags);
  window.sessionStorage.setItem('selected-tags', newTags.join(','));
};

export const ToggleFileType = (
  type: FileType,
  typeFilter: FileType[],
  setTypeFilter: (typeFilter: FileType[]) => void
) => {
  const index = typeFilter.indexOf(type);
  if (index >= 0) {
    setTypeFilter(update(typeFilter, { $splice: [[index, 1]] }));
  } else {
    setTypeFilter(update(typeFilter, { $push: [type] }));
  }
};

export const GetSelectedTags = (): string[] => {
  return (
    window.sessionStorage
      .getItem('selected-tags')
      ?.split(',')
      .filter((t) => t !== '') ?? []
  );
};

export const GetTypeFilter = (): FileType[] => {
  return (
    window.sessionStorage
      .getItem('type-filter')
      ?.split(',')
      .filter((t) => t !== '')
      .map((s) => s as FileType) ?? []
  );
};

export const LoadGlobalTags = async (): Promise<string[]> => {
  return window.api.getGlobalTags();
};
