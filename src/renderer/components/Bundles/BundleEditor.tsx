import {
  Alert,
  Button,
  ControlGroup,
  FormGroup,
  InputGroup,
  Menu,
  Position,
  TagInput,
  TagInputAddMethod,
  TextArea,
  Toaster,
  ToasterInstance,
} from '@blueprintjs/core';
import { ContextMenu2, MenuItem2, Popover2 } from '@blueprintjs/popover2';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import cn from 'classnames';
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { arraysEqual } from 'renderer/scripts/utils';
import { ImportType } from 'shared/constants';
import { BundleDetailsContextType } from './BundleDetailsLayout';

function BundleEditor() {
  const { bundle } = useOutletContext<BundleDetailsContextType>();
  const queryClient = useQueryClient();
  const toasterRef = useRef<Toaster>(null);
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

      queryClient.setQueriesData({ queryKey: ['tags', bundle.id] }, tags ?? []);
      queryClient.invalidateQueries({ queryKey: ['tags'] });

      try {
        const newBundle = await window.api.updateBundle(bundle.id, newBundleInfo.bundle);

        if (newBundle) {
          bundle.bundle = newBundle;
        }

        queryClient.invalidateQueries({ queryKey: ['bundle', bundle?.id] });
      } catch (error: any) {
        toasterRef.current?.show({ message: error.message, intent: 'danger' });
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
    mutationFn: async (filePath?: string) => {
      if ((link || filePath) && bundle.id) {
        try {
          await window.api.downloadPreview(bundle.id, filePath ?? link ?? '');
          await new Promise((r) => setTimeout(r, 100));
          return;
        } catch (error: any) {
          toasterRef?.current?.show({ message: `${error}`, intent: 'danger' });
        }
      }
      throw new Error('No Bundle or link');
    },
    onSuccess(data, variables, onMutateResult, context) {
      queryClient
        .refetchQueries({ queryKey: ['bundle', bundle.id] })
        .then(() => setChangeTime(new Date().getTime()))
        .catch(() => {});
    },
  });

  const handleImport = useCallback(
    async (type: ImportType) => {
      if (link) {
        try {
          const metadata = await window.api.importBundleMetadata(link ?? '', type);
          if (metadata.description) {
            setDescription(metadata.description);
          }
          setTags(metadata.tags ?? []);
        } catch (error: any) {
          const toaster = toasterRef?.current as ToasterInstance;
          toaster?.show({ message: `${error}`, intent: 'danger' });
        }
      }
    },
    [link, setDescription, setTags],
  );

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
    const dragEnterHandler = (e: DragEvent) => {
      setIsDragging(true);
    };
    const dragLeaveHandler = (e: DragEvent) => {
      setIsDragging(false);
    };
    const dragOverHandler = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    };
    const dropHandler = (e: DragEvent) => {
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
          onDrop={(e) => {
            console.log(e.dataTransfer?.files[0].path);
            downloadPreviewMutation(e.dataTransfer?.files[0].path);
            setIsDraggingOverPreview(false);
          }}
        >
          <ContextMenu2
            content={
              <Menu>
                <MenuItem2
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
          </ContextMenu2>
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
          growVertically
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
      <Popover2
        minimal
        position="bottom"
        content={
          <Menu>
            <MenuItem2
              onClick={() => handleImport(ImportType.OpenGraph)}
              icon="import"
              title="Download metadata from the link"
              label="Open Graph"
            />
            <MenuItem2
              onClick={() => handleImport(ImportType.Ollama)}
              icon="predictive-analysis"
              title="Use Ollama llm to generate all the metadata based on the link page's contents. This is the most advanced and slow option. You need to have ollama running locally with the model gemma3"
              label="Ollama"
            />
          </Menu>
        }
      >
        <Button rightIcon="caret-down" disabled={!link}>
          Import
        </Button>
      </Popover2>
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
        Are you sure you want to delete the bundle, your files will <b>NOT</b> be lost.
      </Alert>
    </form>
  );
}

export default BundleEditor;
