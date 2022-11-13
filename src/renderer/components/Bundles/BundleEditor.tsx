import {
  Alert,
  Button,
  ControlGroup,
  FileInput,
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
  UseMutateFunction,
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
import { arraysEqual } from 'renderer/scripts/utils';
import { BundleDetailsContextType } from './BundleDetailsLayout';

const useQueryAndSetter = <T,>(
  keys: any[],
  parent: any | undefined,
  defaultValueGetter: () => Promise<T>
): [
  value: UseQueryResult<T, unknown>,
  setValue: UseMutateFunction<void, unknown, T | undefined, unknown>
] => {
  const queryClient = useQueryClient();
  const value = useQuery<T>(keys, async () => defaultValueGetter(), {
    enabled: !!parent,
  });

  const { mutate: setValue } = useMutation(keys, async (v: T | undefined) => {
    queryClient.setQueryData(keys, v);
  });

  return [value, setValue];
};

const BundleEditor = () => {
  const { bundle } = useOutletContext<BundleDetailsContextType>();
  const { database, files } = useContext(AppContext);
  const queryClient = useQueryClient();
  const toasterRef = useRef<Toaster>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const [description, setDescription] = useQueryAndSetter(
    ['newDescription', bundle.data?.bundle],
    bundle.data,
    async () => bundle.data?.bundle.description
  );
  const [link, setLink] = useQueryAndSetter(
    ['newLink', bundle.data?.bundle],
    bundle.data,
    async () => bundle.data?.bundle.sourceUrl
  );
  const [preview, setPreview] = useQueryAndSetter(
    ['newPreview', bundle.data?.bundle],
    bundle.data,
    async () => bundle.data?.previewUrl
  );
  const [name, setName] = useQueryAndSetter(
    ['newName', bundle.data?.bundle],
    bundle.data,
    async () => bundle.data?.name
  );
  const [tags, setTags] = useQueryAndSetter(
    ['newTags', bundle.data?.bundle],
    bundle.data,
    async () => window.api.getTags(bundle.data?.id ?? '')
  );

  const currentTags = useQuery<string[]>(
    ['tags', bundle.data?.id],
    async () => {
      return window.api.getTags(bundle.data?.id ?? '');
    }
  );

  const changed = useMemo(
    () =>
      description.data !== bundle.data?.bundle.description ||
      link.data !== bundle.data?.bundle.sourceUrl ||
      name.data !== bundle.data?.name ||
      preview.data !== bundle.data?.previewUrl ||
      !arraysEqual(currentTags.data, tags.data),
    [currentTags.data, tags.data, bundle.data, description, link, name, preview]
  );

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();

      if (!bundle.data?.bundle) {
        return;
      }

      const target = e.target as typeof e.target & {
        description: { value: string };
        sourceUrl: { value: string };
        name: { value: string };
        preview: { value: string };
      };

      const newBundleInfo = structuredClone(bundle.data);
      if (newBundleInfo.bundle) {
        newBundleInfo.bundle.description = description.data;
        newBundleInfo.bundle.sourceUrl = link.data;
        if (bundle.data.isVirtual) {
          const virtualNewBundleInfo = newBundleInfo as VirtualBundle;
          virtualNewBundleInfo.name = name.data ?? '';
          virtualNewBundleInfo.previewUrl = preview.data;
        }
      }

      const newTags = await window.api.updateTags(
        bundle.data?.id ?? '',
        tags.data ?? []
      );

      queryClient.setQueriesData(['tags', bundle.data?.id], newTags);
      queryClient.invalidateQueries(['tags', database]);

      try {
        const newBundle = await window.api.updateBundle(
          bundle.data.id,
          newBundleInfo.bundle
        );

        if (newBundle) {
          bundle.data.bundle = newBundle;
        } else {
          bundle.data = undefined;
        }

        queryClient.invalidateQueries(['bundle', bundle.data?.id]);
      } catch (error: any) {
        toasterRef.current?.show({ message: error.message, intent: 'danger' });
      }
    },
    [bundle, tags, database, queryClient]
  );

  const handleDeleteButton = () => {
    setDeleteConfirm(true);
  };

  const handleDelete = useCallback(async () => {
    await window.api.deleteBundle(bundle.data!.id);
    queryClient.invalidateQueries(['files']);
    queryClient.invalidateQueries(['bundle', bundle.data?.id]);
  }, [queryClient, bundle.data]);

  const handleReset = useCallback(() => {
    name.refetch();
    description.refetch();
    link.refetch();
    preview.refetch();
    tags.refetch();
  }, [name, description, link, preview, tags]);

  const handlePreviewUpdate = useCallback(async () => {
    if (link && bundle.data?.id) {
      try {
        await window.api.downloadPreview(bundle.data?.id, link.data ?? '');
        bundle.refetch();
        files.refetch();
      } catch (error: any) {
        toasterRef?.current?.show({ message: `${error}`, intent: 'danger' });
      }
    }
  }, [link, files, bundle]);

  const handleImport = useCallback(async () => {
    if (link) {
      try {
        const metadata = await window.api.importBundleMetadata(link.data ?? '');
        if (metadata.description) {
          setDescription(metadata.description);
        }
      } catch (error: any) {
        const toaster = toasterRef?.current as ToasterInstance;
        toaster?.show({ message: `${error}`, intent: 'danger' });
      }
    }
  }, [link, setDescription]);

  const handleTagDelete = useCallback(
    (tag: ReactNode, index: number) => {
      setTags((tags.data ?? []).filter((t, i) => i !== index));
    },
    [setTags, tags]
  );

  const handleTagAdd = useCallback(
    (values: string[], method: TagInputAddMethod): boolean | void => {
      setTags([...(tags?.data ?? []), ...values]);
    },
    [setTags, tags]
  );

  if (!bundle.data) {
    return <></>;
  }

  return (
    <>
      <form
        className="bundle-editor"
        onSubmit={handleSubmit}
        onReset={handleReset}
      >
        <FormGroup label="Name">
          <InputGroup
            className={name.data !== bundle.data!.name ? 'changed' : undefined}
            disabled={!bundle.data.isVirtual}
            name="name"
            fill
            value={name.data}
            onChange={(v) => setName(v.target.value)}
          />
        </FormGroup>

        <FormGroup label="Preview">
          <ControlGroup>
            <div id="preview">
              <img alt="preview" src={bundle.data!.previewUrl} />
            </div>
            <InputGroup
              className={
                preview.data !== bundle.data!.previewUrl ? 'changed' : undefined
              }
              disabled={!bundle.data.isVirtual}
              name="preview"
              fill
              value={preview.data}
              onChange={(v) => setPreview(v.target.value)}
            />
            {!bundle.data.isVirtual && (
              <Button
                disabled={!link}
                onClick={handlePreviewUpdate}
                icon="import"
                title="Download preview image from link and save it to disk"
              >
                Update Preview
              </Button>
            )}
          </ControlGroup>
        </FormGroup>

        <FormGroup label="Description">
          <TextArea
            name="description"
            className={
              description.data !== bundle.data!.bundle.description
                ? 'changed'
                : undefined
            }
            fill
            value={description.data}
            onChange={(v) => setDescription(v.target.value)}
          />
        </FormGroup>
        <FormGroup label="Link" labelFor="sourceUrl">
          <InputGroup
            type="url"
            name="sourceUrl"
            className={
              link.data !== bundle.data!.bundle.sourceUrl
                ? 'changed'
                : undefined
            }
            fill
            value={link.data}
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
        <Button
          disabled={!link}
          onClick={handleImport}
          icon="import"
          title="Download metadata from the link"
        >
          Import
        </Button>
        <Button icon="trash" onClick={handleDeleteButton} intent="danger">
          Delete
        </Button>
        <Toaster position={Position.BOTTOM_RIGHT} ref={toasterRef} />
        <Alert
          intent="danger"
          confirmButtonText="Delete"
          isOpen={deleteConfirm}
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(false)}
          canEscapeKeyCancel
          cancelButtonText="Cancel"
          icon="trash"
        >
          Are you sure you want to delete the bundle, your files will <b>NOT</b>{' '}
          be lost.
        </Alert>
      </form>
    </>
  );
};

export default BundleEditor;
