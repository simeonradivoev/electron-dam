import {
  Alert,
  Button,
  ContextMenu,
  ControlGroup,
  FormGroup,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
  TagInput,
  TagInputAddMethod,
  TextArea,
  Tooltip,
} from '@blueprintjs/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import cn from 'classnames';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useBlocker, useOutletContext } from 'react-router-dom';
import { arraysEqual, QueryKeys } from 'renderer/scripts/utils';
import { AppToaster } from 'renderer/toaster';
import { ImportType } from 'shared/constants';
import { BundleDetailsContextType } from './BundleDetailsLayout';

function BundleEditor() {
  const { bundle } = useOutletContext<BundleDetailsContextType>();
  const queryClient = useQueryClient();
  const previewInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const [description, setDescription] = useState(() => bundle.bundle.description);
  const [link, setLink] = useState(bundle.bundle.sourceUrl);
  const [preview, setPreview] = useState(bundle.previewUrl);
  const [name, setName] = useState(bundle.name);
  const [tags, setTags] = useState(bundle.bundle.tags);
  const [isDraggingOverPreview, setIsDraggingOverPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [changedTime, setChangeTime] = useState(0);
  const { data: canImportWithOllama } = useQuery({
    queryKey: ['can-import-metadata', bundle.id],
    queryFn: () => window.api.canImportBundleMetadata(bundle.id, ImportType.Ollama),
  });

  const changed = useMemo(
    () =>
      description !== bundle.bundle.description ||
      link !== bundle.bundle.sourceUrl ||
      name !== bundle.name ||
      preview !== bundle.previewUrl ||
      !arraysEqual(tags, bundle.bundle.tags),
    [
      description,
      bundle.bundle.description,
      bundle.bundle.sourceUrl,
      bundle.bundle.tags,
      bundle.name,
      bundle.previewUrl,
      link,
      name,
      preview,
      tags,
    ],
  );

  const blocker = useBlocker(changed);

  const handleSubmit = useCallback(
    async (e: React.SyntheticEvent) => {
      e.preventDefault();

      if (!bundle.bundle) {
        return;
      }

      const target = e.target as typeof e.target & {
        description: { value: string };
        sourceUrl: { value: string };
        name: { value: string };
        preview: { value: string };
      };

      const newBundleInfo = structuredClone(bundle);
      if (newBundleInfo.bundle) {
        newBundleInfo.bundle.description = description;
        newBundleInfo.bundle.sourceUrl = link;
        newBundleInfo.bundle.tags = tags;
        if (bundle.isVirtual) {
          const virtualNewBundleInfo = newBundleInfo as VirtualBundle;
          virtualNewBundleInfo.name = name ?? '';
          virtualNewBundleInfo.previewUrl = preview;
        }
      }

      queryClient.setQueriesData({ queryKey: [QueryKeys.tags, bundle.id] }, tags ?? []);
      queryClient.invalidateQueries({ queryKey: [QueryKeys.tags] });

      try {
        const newBundle = await window.api.updateBundle(bundle.id, newBundleInfo.bundle);

        if (newBundle) {
          bundle.bundle = newBundle;
        }

        queryClient.invalidateQueries({ queryKey: ['bundle', bundle?.id] });
      } catch (error: any) {
        AppToaster.then((t) => t.show({ message: error.message, intent: 'danger' }));
      }
    },
    [bundle, tags, queryClient, description, link, name, preview],
  );

  const handleDeleteButton = () => {
    setDeleteConfirm(true);
  };

  const handleDelete = useCallback(async () => {
    await window.api.deleteBundle(bundle.id);
    queryClient.invalidateQueries({ queryKey: ['files'] });
    queryClient.invalidateQueries({ queryKey: ['bundle', bundle.id] });
  }, [queryClient, bundle]);

  const handleReset = useCallback(() => {
    setName(bundle.name);
    setDescription(bundle.bundle.description);
    setLink(bundle.bundle.sourceUrl);
    setPreview(bundle.previewUrl);
    setTags(bundle.bundle.tags);
  }, [
    bundle.name,
    bundle.bundle.description,
    bundle.bundle.sourceUrl,
    bundle.bundle.tags,
    bundle.previewUrl,
  ]);

  const { mutate: downloadPreviewMutation, isPending: isDownloadingPreview } = useMutation({
    mutationKey: ['preview-download', bundle.id],
    mutationFn: async (data?: Promise<Uint8Array<ArrayBuffer>>) => {
      if ((link || data) && bundle.id) {
        await window.api.downloadPreview(bundle.id, (await data) ?? link ?? '');
        await new Promise((r) => {
          setTimeout(r, 100);
        });
      } else {
        throw new Error('No Bundle or link');
      }
    },
    onError: (error) => AppToaster.then((t) => t.show({ message: `${error}`, intent: 'danger' })),
    onSuccess() {
      queryClient
        .refetchQueries({ queryKey: ['bundle', bundle.id] })
        .then(() => setChangeTime(new Date().getTime()))
        .catch(() => {});
    },
  });

  const importMutation = useMutation({
    mutationKey: ['auto-metadata', bundle.id],
    mutationFn: async (type: ImportType) => window.api.importBundleMetadata(link ?? '', type),
    onError: (error) => AppToaster?.then((t) => t.show({ message: `${error}`, intent: 'danger' })),
    onSuccess: (metadata) => {
      if (metadata.description) {
        setDescription(metadata.description);
        console.log(metadata.description);
      }
      setTags(metadata.tags ?? []);
    },
  });

  const handleTagDelete = useCallback(
    (tag: ReactNode, index: number) => {
      setTags((tags ?? []).filter((t, i) => i !== index));
    },
    [setTags, tags],
  );

  const handleTagAdd = useCallback(
    (values: string[], method: TagInputAddMethod): boolean | void => {
      setTags([...(tags ?? []), ...values]);
    },
    [setTags, tags],
  );

  const handleSubmitButton = useCallback(() => {
    formRef.current?.requestSubmit();
  }, [formRef]);

  useEffect(() => {
    const dragEnterHandler = () => {
      setIsDragging(true);
    };
    const dragLeaveHandler = () => {
      setIsDragging(false);
    };
    const dragOverHandler = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const dropHandler = () => {
      setIsDragging(false);
    };
    document.body.addEventListener('dragenter', dragEnterHandler);
    document.body.addEventListener('dragleave', dragLeaveHandler);
    document.body.addEventListener('dragover', dragOverHandler);
    document.body.addEventListener('drop', dropHandler);
    return () => {
      document.body.removeEventListener('dragenter', dragEnterHandler);
      document.body.removeEventListener('dragleave', dragLeaveHandler);
      document.body.removeEventListener('dragover', dragOverHandler);
      document.body.removeEventListener('drop', dropHandler);
    };
  }, []);

  if (!bundle) {
    return <></>;
  }

  return (
    <form className="bundle-editor" onSubmit={handleSubmit} onReset={handleReset} ref={formRef}>
      <FormGroup label="Name">
        <InputGroup
          className={name !== bundle.name ? 'changed' : undefined}
          disabled={!bundle.isVirtual}
          name="name"
          fill
          value={name}
          onChange={(v) => setName(v.target.value)}
        />
      </FormGroup>

      <FormGroup label="Preview">
        <ControlGroup
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDraggingOverPreview(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDraggingOverPreview(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOverPreview(true);
          }}
          onDrop={async (e) => {
            downloadPreviewMutation(e.dataTransfer?.files[0].bytes());
            setIsDraggingOverPreview(false);
          }}
        >
          <ContextMenu
            content={
              <Menu>
                <MenuItem
                  text="Show In Windows Explorer"
                  icon="folder-shared-open"
                  onClick={() => bundle.previewUrl && window.api.openPath(bundle.previewUrl)}
                />
              </Menu>
            }
          >
            <div id="preview">
              <img
                alt="preview"
                draggable={false}
                src={
                  bundle.isVirtual ? bundle.previewUrl : `thumb://${bundle.id}?ver=${changedTime}`
                }
              />
            </div>
          </ContextMenu>
          <InputGroup
            inputRef={previewInputRef}
            id="preview-input"
            className={cn({ changed: preview !== bundle.previewUrl })}
            inputClassName={cn({ dragging: isDragging, draggingOver: isDraggingOverPreview })}
            disabled={!bundle.isVirtual}
            name="preview"
            fill
            value={isDragging ? 'DROP PREVIEW FILE HERE TO UPDATE' : preview}
            leftIcon={isDragging ? 'select' : undefined}
            onChange={(v) => setPreview(v.target.value)}
          />
          {!bundle.isVirtual && (
            <Button
              disabled={!link}
              onClick={() => downloadPreviewMutation(undefined)}
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
          id="description"
          maxLength={512}
          className={description !== bundle.bundle.description ? 'changed' : undefined}
          fill
          value={description}
          onChange={(v) => setDescription(v.target.value)}
        />
      </FormGroup>
      <FormGroup label="Link" labelFor="sourceUrl">
        <ControlGroup>
          <InputGroup
            type="url"
            name="sourceUrl"
            className={link !== bundle.bundle.sourceUrl ? 'changed' : undefined}
            fill
            value={link}
            onChange={(v) => setLink(v.target.value)}
          />
          <Button icon="link" onClick={() => window.open(link, '_blank')} />
        </ControlGroup>
      </FormGroup>
      <FormGroup label="Tags">
        <TagInput
          values={tags ?? []}
          onRemove={handleTagDelete}
          onAdd={handleTagAdd}
          className={!arraysEqual(tags, bundle.bundle.tags) ? 'changed' : undefined}
        />
      </FormGroup>
      <Button
        icon="floppy-disk"
        intent={changed ? 'success' : 'none'}
        disabled={!changed || isDownloadingPreview}
        onClick={handleSubmitButton}
      >
        Save
      </Button>
      <Button disabled={!changed} icon="reset" type="reset">
        Reset
      </Button>
      <Popover
        minimal
        position="bottom"
        content={
          <Menu>
            <Tooltip
              targetTagName="li"
              content="Download metadata from the link"
              hoverOpenDelay={2000}
            >
              <MenuItem
                disabled={importMutation.isPending}
                onClick={() => importMutation.mutate(ImportType.OpenGraph)}
                icon="import"
                text="Open Graph"
              />
            </Tooltip>

            <Tooltip
              targetTagName="li"
              hoverOpenDelay={2000}
              content="Use Ollama llm to generate all the metadata based on the link page's contents. This is the most advanced and slow option. You need to have ollama running"
            >
              <MenuItem
                disabled={!canImportWithOllama || importMutation.isPending}
                onClick={() => importMutation.mutate(ImportType.Ollama)}
                icon="predictive-analysis"
                text="Ollama"
              />
            </Tooltip>
          </Menu>
        }
      >
        <Button endIcon="caret-down" disabled={!link || importMutation.isPending}>
          Import
        </Button>
      </Popover>
      <Button icon="trash" onClick={handleDeleteButton} intent="danger">
        Delete
      </Button>
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
        Are you sure you want to delete the bundle, your files will <b>NOT</b> be lost.
      </Alert>
      <Alert
        icon="warning-sign"
        isOpen={blocker.state === 'blocked'}
        confirmButtonText="Discard"
        cancelButtonText="Cancel"
        canOutsideClickCancel
        onConfirm={() => blocker.proceed?.()}
        onCancel={() => blocker.reset?.()}
      >
        You have unsaved changes!
      </Alert>
    </form>
  );
}

export default BundleEditor;
