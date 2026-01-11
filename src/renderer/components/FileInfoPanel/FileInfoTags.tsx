import { TagInput, TagProps } from '@blueprintjs/core';
import {
  keepPreviousData,
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { normalize } from 'pathe';
import { ReactNode, useCallback } from 'react';
import { QueryKeys } from 'renderer/scripts/utils';

interface FileInfoTagsProps {
  item: string;
  filter: string | null;
  allowEditing?: boolean;
  contextMenu?: JSX.Element;
}

function FileInfoTags({
  item,
  filter,
  allowEditing = true,
  contextMenu = undefined,
}: FileInfoTagsProps) {
  // Access the client
  const queryClient = useQueryClient();

  const isGeneratingMetadata =
    useIsMutating({ mutationKey: [QueryKeys.metadata, normalize(item)] }) > 0;

  const { mutate: addTagMutation } = useMutation({
    mutationKey: [QueryKeys.tags, normalize(item)],
    mutationFn: async (tagsToAdd: string[]) => window.api.addTags(item, tagsToAdd),
    onSuccess: (data) => queryClient.setQueryData([QueryKeys.tags, normalize(item)], data),
  });

  const { mutate: removeTagsMutation, isPending: isRemovingTag } = useMutation({
    mutationKey: [QueryKeys.tags, normalize(item)],
    mutationFn: async (tagToRemove: string) => window.api.removeTag(item, tagToRemove),
    onSuccess: (data) => queryClient.setQueryData([QueryKeys.tags, normalize(item)], data),
  });

  const tags = useQuery({
    placeholderData: keepPreviousData,
    queryKey: [QueryKeys.tags, normalize(item)],
    queryFn: async () => {
      return (await window.api.getTags(item)) ?? [];
    },
  });

  const { data: node } = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ['bundle', normalize(item)],
    queryFn: async () => window.api.getFile(item),
  });

  const parentTags = useQuery({
    placeholderData: keepPreviousData,
    queryKey: ['parent-tags', normalize(item)],
    queryFn: async () => {
      return (await window.api.getParentTags(item)) ?? [];
    },
  });

  const removeTag = useCallback(
    (tag: ReactNode, index: number) => {
      removeTagsMutation(tags.data?.at(index) ?? '');
    },
    [removeTagsMutation, tags.data],
  );

  const isBundle = !!node?.bundlePath && node.bundlePath === node.path;
  const isNonBundleFolder = node?.isDirectory && !isBundle;

  return (
    <>
      {tags.isError ? tags.error : undefined}
      <TagInput
        fill
        leftIcon="tag"
        className="tags"
        disabled={
          !tags.data ||
          isNonBundleFolder ||
          isRemovingTag ||
          isGeneratingMetadata ||
          !allowEditing ||
          (node?.isArchived && !isBundle)
        }
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
