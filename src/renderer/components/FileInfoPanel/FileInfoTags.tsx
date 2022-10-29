import { TagInput, TagProps } from '@blueprintjs/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IDBPDatabase } from 'idb';
import React, { ReactNode } from 'react';

interface FileInfoTagsProps {
  database: IDBPDatabase<FilesDB> | undefined;
  fileInfo: FileInfo | null;
  filter: string | undefined;
}

const FileInfoTags: React.FC<FileInfoTagsProps> = ({
  database,
  fileInfo,
  filter,
}) => {
  // Access the client
  const queryClient = useQueryClient();

  const mutation = useMutation(
    ['tags', fileInfo?.path],
    async (values: string[]) => {
      return window.api.updateTags(fileInfo?.path ?? '', values);
    },
    {
      onSuccess: (data) => {
        queryClient.setQueriesData(['tags', fileInfo?.path], data);
        queryClient.invalidateQueries(['tags', database]);
      },
    }
  );

  const tags = useQuery<string[]>(
    ['tags', fileInfo],
    async () => {
      return window.api.getTags(fileInfo?.path ?? '');
    },
    { enabled: !!fileInfo, keepPreviousData: true }
  );

  const parentTags = useQuery<string[]>(
    ['parent-tags', fileInfo],
    async () => {
      return window.api.getParentTags(fileInfo?.path ?? '');
    },
    { enabled: !!fileInfo, keepPreviousData: true }
  );

  const addTags = (tagsToAdd: string[]) => {
    mutation.mutate(tags.data?.concat(tagsToAdd) ?? tagsToAdd);
  };

  const removeTag = (tag: ReactNode, index: number) => {
    mutation.mutate(tags.data?.filter((t, i) => i !== index) ?? []);
  };

  const isNonBundleFolder =
    fileInfo?.isDirectory &&
    (!fileInfo.bundle || fileInfo.bundle.isParentBundle);

  return (
    <>
      {tags.isError ? <>{tags.error}</> : <></>}
      <TagInput
        leftIcon="tag"
        disabled={!tags.data || isNonBundleFolder}
        className="tags"
        onAdd={addTags}
        tagProps={(tagElement, index) => {
          const isParentTag = tags?.data && index >= tags.data.length;
          const props: TagProps = isParentTag
            ? {
                minimal: isParentTag || tags.isPreviousData,
                onRemove: undefined,
              }
            : {
                onRemove: () => {
                  removeTag(tagElement, index);
                },
              };
          return props;
        }}
        values={
          tags.data
            ?.concat(
              parentTags.data?.filter(
                (parentTag) => !tags.data.includes(parentTag)
              ) ?? []
            )
            ?.map((tag) =>
              filter &&
              tag.toLocaleLowerCase().includes(filter.toLocaleLowerCase()) ? (
                <mark>{tag}</mark>
              ) : (
                tag
              )
            ) ?? []
        }
      />
    </>
  );
};

export default FileInfoTags;
