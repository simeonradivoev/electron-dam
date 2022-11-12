import {
  Button,
  FormGroup,
  InputGroup,
  Label,
  Position,
  TagInput,
  TagInputAddMethod,
  TextArea,
  Toaster,
  ToasterInstance,
} from '@blueprintjs/core';
import {
  useMutation,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from '@tanstack/react-query';
import React, {
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useOutletContext } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';
import { BundleInfoContextType } from './BundleInfo';

const arraysEqual = <T,>(lhs: T[] | undefined, rhs: T[] | undefined) => {
  if (!lhs && !rhs) {
    return true;
  }

  if (!rhs) {
    return false;
  }

  if (!lhs) {
    return false;
  }

  if (lhs.length !== rhs.length) {
    return false;
  }

  for (let index = 0; index < lhs.length; index += 1) {
    if (lhs[index] !== rhs[index]) {
      return false;
    }
  }

  return true;
};

const BundleEditor = () => {
  const { fileInfo } = useOutletContext<BundleInfoContextType>();

  const { database } = useContext(AppContext);
  const queryClient = useQueryClient();
  const toasterRef = useRef<any>();

  const [description, setDescription] = useState(
    fileInfo.data?.bundle?.bundle.description
  );
  const [link, setLink] = useState(fileInfo.data?.bundle?.bundle.sourceUrl);
  const currentTags = useQuery<string[]>(
    ['tags', fileInfo.data?.path],
    async () => {
      return window.api.getTags(fileInfo.data?.path ?? '');
    }
  );
  const tags = useQuery<string[]>(
    ['tags', fileInfo.data?.path, fileInfo.data?.bundle?.bundle],
    async () => {
      return window.api.getTags(fileInfo.data?.path ?? '');
    }
  );
  const updateTags = useMutation(
    ['tags', fileInfo.data?.path, fileInfo.data?.bundle?.bundle],
    async (values: string[]) => {
      return values;
    },
    {
      onSuccess: (data) => {
        queryClient.setQueriesData(
          ['tags', fileInfo.data?.path, fileInfo.data?.bundle?.bundle],
          data
        );
      },
    }
  );

  const changed = useMemo(
    () =>
      description !== fileInfo.data?.bundle?.bundle.description ||
      link !== fileInfo.data?.bundle?.bundle.sourceUrl ||
      !arraysEqual(currentTags.data, tags.data),
    [
      currentTags.data,
      tags.data,
      fileInfo.data?.bundle?.bundle.description,
      fileInfo.data?.bundle?.bundle.sourceUrl,
      description,
      link,
    ]
  );

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();

      if (!fileInfo.data?.bundle) {
        return;
      }

      const target = e.target as typeof e.target & {
        description: { value: string };
        sourceUrl: { value: string };
      };

      const newFileInfo = structuredClone(fileInfo.data);
      newFileInfo.bundle!.bundle.description = target.description.value;
      newFileInfo.bundle!.bundle.sourceUrl = target.sourceUrl.value;

      const newTags = await window.api.updateTags(
        fileInfo.data?.path ?? '',
        tags.data ?? []
      );

      queryClient.setQueriesData(['tags', fileInfo.data?.path], newTags);
      queryClient.invalidateQueries(['tags', database]);

      const newBundle = await window.api.updateBundle(
        fileInfo.data.path,
        newFileInfo.bundle!.bundle
      );

      if (newBundle) {
        fileInfo.data.bundle.bundle = newBundle;
      } else {
        fileInfo.data.bundle = undefined;
      }

      queryClient.setQueriesData(
        ['fileInfo', fileInfo.data?.path],
        newFileInfo
      );
    },
    [fileInfo, tags, database, queryClient]
  );

  const handleDelete = useCallback(async () => {
    await window.api.deleteBundle(fileInfo.data!.path);
    queryClient.invalidateQueries(['files']);
    queryClient.invalidateQueries(['fileInfo', fileInfo.data!.path]);
  }, [queryClient, fileInfo.data?.path]);

  const handleReset = useCallback(() => {
    setDescription(fileInfo.data!.bundle?.bundle.description);
    setLink(fileInfo.data!.bundle?.bundle.sourceUrl);
    updateTags.mutate(currentTags?.data ?? []);
  }, [setDescription, setLink, fileInfo, updateTags, currentTags]);

  const handleImport = useCallback(async () => {
    if (link) {
      try {
        const metadata = await window.api.importBundleMetadata(link);
        if (metadata.description) {
          setDescription(metadata.description);
        }
      } catch (error: any) {
        const toaster = toasterRef?.current as ToasterInstance;
        toaster?.show({ message: `${error}`, intent: 'danger' });
      }
    }
  }, [link]);

  const handleTagDelete = useCallback(
    (tag: ReactNode, index: number) => {
      updateTags.mutate((tags.data ?? []).filter((t, i) => i !== index));
    },
    [updateTags, tags]
  );

  const handleTagAdd = useCallback(
    (values: string[], method: TagInputAddMethod): boolean | void => {
      updateTags.mutate([...(tags?.data ?? []), ...values]);
    },
    [updateTags, tags]
  );

  if (!fileInfo.data) {
    return <></>;
  }

  return (
    <>
      <form onSubmit={handleSubmit} onReset={handleReset}>
        <FormGroup label="Name">
          <InputGroup
            disabled
            name="name"
            fill
            defaultValue={fileInfo.data!.name}
          />
        </FormGroup>

        <FormGroup label="Description">
          <TextArea
            name="description"
            className={
              description !== fileInfo.data!.bundle?.bundle.description
                ? 'changed'
                : undefined
            }
            fill
            value={description}
            onChange={(v) => setDescription(v.target.value)}
          />
        </FormGroup>
        <FormGroup label="Link" labelFor="sourceUrl">
          <InputGroup
            type="url"
            name="sourceUrl"
            className={
              link !== fileInfo.data!.bundle?.bundle.sourceUrl
                ? 'changed'
                : undefined
            }
            fill
            value={link}
            onChange={(v) => setLink(v.target.value)}
          />
        </FormGroup>
        <FormGroup label="Tags">
          <TagInput
            values={tags.data ?? []}
            onRemove={handleTagDelete}
            onAdd={handleTagAdd}
          />
        </FormGroup>
        <Button
          icon="floppy-disk"
          intent={changed ? 'success' : 'none'}
          disabled={!changed}
          type="submit"
        >
          Save
        </Button>
        <Button disabled={!changed} icon="reset" type="reset">
          Reset
        </Button>
        <Button disabled={!link} onClick={handleImport} icon="import">
          Import
        </Button>
        <Button icon="trash" onClick={handleDelete} intent="danger">
          Delete
        </Button>
        <Toaster position={Position.BOTTOM_RIGHT} ref={toasterRef} />
      </form>
    </>
  );
};

export default BundleEditor;
