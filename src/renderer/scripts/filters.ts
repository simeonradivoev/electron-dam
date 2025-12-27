import { FileType } from 'shared/constants';

export const ToggleTag = (
  tag: string,
  selectedTags: string[],
  setSelectedTags: (tags: string[]) => void,
) => {
  const index = selectedTags.indexOf(tag);

  let newTags: string[];
  if (index >= 0) {
    newTags = [...selectedTags.slice(0, index), ...selectedTags.slice(index + 1)];
  } else {
    newTags = [...selectedTags, ...[tag]];
  }

  setSelectedTags(newTags);
  window.sessionStorage.setItem('selected-tags', newTags.join(','));
};

export const ToggleFileType = (
  type: FileType,
  typeFilter: FileType[],
  setTypeFilter: (typeFilter: FileType[]) => void,
) => {
  const index = typeFilter.indexOf(type);
  if (index >= 0) {
    setTypeFilter([...typeFilter.slice(0, index), ...typeFilter.slice(index + 1)]);
  } else {
    setTypeFilter([...typeFilter, ...[type]]);
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
