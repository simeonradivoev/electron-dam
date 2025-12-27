import { TagInput, TagProps } from '@blueprintjs/core';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { normalize } from 'pathe';
import { ReactNode, useCallback } from 'react';

interface FileInfoTagsProps {
  fileInfo: FileInfo | null;
  filter: string | null;
  contextMenu?: JSX.Element;
}

function FileInfoTags({ fileInfo, filter, contextMenu = undefined }: FileInfoTagsProps) {
  // Access the client
  const queryClient = useQueryClient();

  const { mutate: addTagMutation } = useMutation({
    mutationKey: ['tags', normalize(fileInfo?.path ?? '')],
    mutationFn: async (tagsToAdd: string[]) => window.api.addTags(fileInfo?.path ?? '', tagsToAdd),
    onSuccess: (data) => queryClient.setQueryData(['tags', normalize(fileInfo?.path ?? '')], data),
  });

  const { mutate: removeTagsMutation, isPending: isRemovingTag } = useMutation({
    mutationKey: ['tags', normalize(fileInfo?.path ?? '')],
    mutationFn: async (tagToRemove: string) =>
      window.api.removeTag(fileInfo?.path ?? '', tagToRemove),
    onSuccess: (data) => queryClient.setQueryData(['tags', normalize(fileInfo?.path ?? '')], data),
  });

  const tags = useQuery({
    enabled: !!fileInfo,
    placeholderData: keepPreviousData,
    queryKey: ['tags', normalize(fileInfo?.path ?? '')],
    queryFn: async () => {
      return (await window.api.getTags(fileInfo?.path ?? '')) ?? [];
    },
  });

  const parentTags = useQuery({
    enabled: !!fileInfo,
    placeholderData: keepPreviousData,
    queryKey: ['parent-tags', normalize(fileInfo?.path ?? '')],
    queryFn: async () => {
      return (await window.api.getParentTags(fileInfo?.path ?? '')) ?? [];
    },
  });

  const removeTag = useCallback(
    (tag: ReactNode, index: number) => {
      removeTagsMutation(tags.data?.at(index) ?? '');
    },
    [removeTagsMutation, tags.data],
  );

  const isNonBundleFolder =
    fileInfo?.isDirectory && (!fileInfo.bundle || fileInfo.bundle.isParentBundle);

  return (
    <>
      {tags.isError ? <>{tags.error}</> : <></>}
      <TagInput
        leftIcon="tag"
        className="tags"
        disabled={!tags.data || isNonBundleFolder || isRemovingTag}
        rightElement={contextMenu}
        onRemove={removeTag}
        onAdd={(t) => addTagMutation(t)}
        tagProps={(tagElement, index) => {
          const isParentTag = tags?.data && index >= tags.data.length;
          const props: TagProps = isParentTag
            ? {
                minimal: isParentTag || tags.isPlaceholderData,
                onRemove: undefined,
              }
            : {};
          return props;
        }}
        values={
          tags.data
            ?.concat(parentTags.data?.filter((parentTag) => !tags.data.includes(parentTag)) ?? [])
            ?.map((tag) =>
              filter && tag.toLocaleLowerCase().includes(filter.toLocaleLowerCase()) ? (
                <mark>{tag}</mark>
              ) : (
                tag
              ),
            ) ?? []
        }
      />
    </>
  );
}

export default FileInfoTags;
