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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IDBPDatabase } from 'idb';
import React, { ReactNode, useCallback, useRef, useState } from 'react';

type Props = {
  fileInfo: FileInfo;
  setFileInfo: (fileInfo: FileInfo | null) => void;
  database: IDBPDatabase<FilesDB> | undefined;
};

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

const BundleEditor = ({ fileInfo, setFileInfo, database }: Props) => {
  const queryClient = useQueryClient();
  const toasterRef = useRef<any>();

  const [description, setDescription] = useState(
    fileInfo.bundle?.bundle.description
  );
  const [link, setLink] = useState(fileInfo.bundle?.bundle.sourceUrl);
  const currentTags = useQuery<string[]>(['tags', fileInfo?.path], async () => {
    return window.api.getTags(fileInfo?.path ?? '');
  });
  const tags = useQuery<string[]>(
    ['tags', fileInfo?.path, fileInfo.bundle?.bundle],
    async () => {
      return window.api.getTags(fileInfo?.path ?? '');
    }
  );
  const updateTags = useMutation(
    ['tags', fileInfo?.path, fileInfo.bundle?.bundle],
    async (values: string[]) => {
      return values;
    },
    {
      onSuccess: (data) => {
        queryClient.setQueriesData(
          ['tags', fileInfo?.path, fileInfo.bundle?.bundle],
          data
        );
      },
    }
  );
  const changed =
    description !== fileInfo.bundle?.bundle.description ||
    link !== fileInfo.bundle?.bundle.sourceUrl ||
    !arraysEqual(currentTags.data, tags.data);

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();

      if (!fileInfo.bundle) {
        return;
      }

      const target = e.target as typeof e.target & {
        description: { value: string };
        sourceUrl: { value: string };
      };

      const newFileInfo = structuredClone(fileInfo);
      newFileInfo.bundle!.bundle.description = target.description.value;
      newFileInfo.bundle!.bundle.sourceUrl = target.sourceUrl.value;

      const newTags = await window.api.updateTags(
        fileInfo?.path ?? '',
        tags.data ?? []
      );

      queryClient.setQueriesData(['tags', fileInfo?.path], newTags);
      queryClient.invalidateQueries(['tags', database]);

      const newBundle = await window.api.updateBundle(
        fileInfo.path,
        newFileInfo.bundle!.bundle
      );

      if (newBundle) {
        fileInfo.bundle.bundle = newBundle;
      } else {
        fileInfo.bundle = undefined;
      }

      setFileInfo(newFileInfo);
    },
    [setFileInfo, fileInfo, tags, database, queryClient]
  );

  const handleDelete = useCallback(async () => {
    await window.api.deleteBundle(fileInfo.path);
    queryClient.invalidateQueries(['files']);
    setFileInfo(null);
  }, [queryClient, fileInfo.path, setFileInfo]);

  const handleReset = useCallback(() => {
    setDescription(fileInfo.bundle?.bundle.description);
    setLink(fileInfo.bundle?.bundle.sourceUrl);
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

  return (
    <>
      <form onSubmit={handleSubmit} onReset={handleReset}>
        <FormGroup label="Name">
          <InputGroup disabled name="name" fill defaultValue={fileInfo.name} />
        </FormGroup>

        <FormGroup label="Description">
          <TextArea
            name="description"
            className={
              description !== fileInfo.bundle?.bundle.description
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
              link !== fileInfo.bundle?.bundle.sourceUrl ? 'changed' : undefined
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
