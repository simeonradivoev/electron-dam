/* eslint-disable react/no-children-prop */
import {
  Alert,
  Button,
  ButtonGroup,
  Classes,
  ContextMenu,
  ControlGroup,
  FormGroup,
  InputGroup,
  Menu,
  MenuItem,
  Popover,
  Tag,
  TagInput,
  TextArea,
  Tooltip,
} from '@blueprintjs/core';
import { useForm } from '@tanstack/react-form';
import { QueryObserverResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import cn from 'classnames';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useBlocker } from 'react-router-dom';
import { ShowAppToaster } from 'renderer/scripts/toaster';
import { QueryKeys } from 'renderer/scripts/utils';
import { AnyMetadataChanges, ImportType } from 'shared/constants';
import { z } from 'zod/v3';

function Warning({ errors }: { errors: any[] }) {
  return errors.length > 0 ? (
    <Tooltip
      intent="danger"
      content={
        <ul className={Classes.LIST_UNSTYLED}>
          {errors.map((e: Error) => (
            <li>{e.message}</li>
          ))}
        </ul>
      }
    >
      <Tag minimal intent="danger" icon="error" />
    </Tooltip>
  ) : undefined;
}

const BundleSchema = z.object({
  name: z.string().nonempty(),
  preview: z.string().optional(),
  link: z.union([z.literal(''), z.string().trim().url()]),
  description: z.string().optional(),
  tags: z
    .array(z.string())
    .superRefine((values, ctx) => {
      const set = new Set(values).size;
      if (set !== values.length) {
        ctx.addIssue({ code: 'custom', message: 'Duplicate Tags' });
      }
    })
    .optional(),
});

export type Params = {
  bundle: BundleInfo;
  refetchBundle: () => Promise<QueryObserverResult<BundleInfo | null, Error>>;
};

function BundleEditor({ bundle, refetchBundle }: Params) {
  const queryClient = useQueryClient();
  const previewInputRef = useRef<HTMLInputElement>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const updateDataMutation = useMutation({
    mutationKey: [QueryKeys.bundles, bundle.id],
    mutationFn: (changes: z.infer<typeof AnyMetadataChanges>) =>
      window.api.updateBundle(bundle.id, changes),
  });

  const form = useForm({
    validators: {
      onChange: BundleSchema,
    },
    defaultValues: {
      name: bundle.name,
      preview: bundle.previewUrl ?? '',
      link: bundle.bundle.sourceUrl ?? '',
      description: bundle.bundle.description ?? '',
      tags: bundle.bundle.tags ?? [],
    } as z.infer<typeof BundleSchema>,
    onSubmit: async ({ value, formApi }) => {
      if (!bundle.bundle) {
        return;
      }

      type MetadataChanges = z.infer<typeof AnyMetadataChanges>;
      type Bundle = z.infer<typeof BundleSchema>;

      const changes: MetadataChanges = {};
      function setCheck<
        K extends keyof Bundle,
        D extends MatchingKeys<MetadataChanges, Bundle[K] | undefined>,
      >(id: K, d: D) {
        if (formApi.getFieldMeta(id)?.isDefaultValue) {
          return;
        }

        (changes as any)[d] = value[id];
      }

      setCheck('name', 'name');
      setCheck('description', 'description');
      setCheck('link', 'sourceUrl');
      setCheck('preview', 'previewUrl');
      setCheck('tags', 'tags');

      try {
        await updateDataMutation.mutateAsync(changes);
        await refetchBundle();
        form.reset();
      } catch (error: any) {
        ShowAppToaster({ message: error.message, intent: 'danger' });
      }
    },
  });
  const [isDraggingOverPreview, setIsDraggingOverPreview] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [changedTime, setChangeTime] = useState(0);
  const { data: canImportWithOllama } = useQuery({
    queryKey: ['can-import-metadata', bundle.id],
    queryFn: () => window.api.canImportBundleMetadata(bundle.id, ImportType.Ollama),
  });

  const handleDeleteButton = () => {
    setDeleteConfirm(true);
  };

  const handleDelete = useCallback(async () => {
    await window.api.deleteBundle(bundle.id);
    queryClient.invalidateQueries({ queryKey: ['files'] });
    queryClient.invalidateQueries({ queryKey: ['bundle', bundle.id] });
  }, [queryClient, bundle]);

  const { mutate: downloadPreviewMutation, isPending: isDownloadingPreview } = useMutation({
    mutationKey: ['preview-download', bundle.id],
    mutationFn: async (data?: Promise<Uint8Array<ArrayBuffer>>) => {
      if ((form.state.values.link || data) && bundle.id) {
        await window.api.downloadPreview(bundle.id, (await data) ?? form.state.values.link ?? '');
        await new Promise((r) => {
          setTimeout(r, 100);
        });
      } else {
        throw new Error('No Bundle or link');
      }
    },
    onError: (error) => ShowAppToaster({ message: `${error}`, intent: 'danger' }),
    onSuccess() {
      queryClient
        .refetchQueries({ queryKey: ['bundle', bundle.id] })
        .then(() => setChangeTime(new Date().getTime()))
        .catch(() => {});
    },
  });

  const importMutation = useMutation({
    mutationKey: ['auto-metadata', bundle.id],
    mutationFn: async (type: ImportType) =>
      window.api.importBundleMetadata(form.state.values.link ?? '', type),
    onError: (error) => ShowAppToaster({ message: `${error}`, intent: 'danger' }),
    onSuccess: (metadata) => {
      if (metadata.description) {
        form.setFieldValue('description', metadata.description);
      }
      form.setFieldValue('tags', metadata.tags ?? []);
    },
  });

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
    <div className="bundle-editor">
      <form.Field
        name="name"
        children={(field) => (
          <FormGroup label="Name">
            <InputGroup
              rightElement={<Warning errors={field.state.meta.errors} />}
              className={cn({ changed: !field.state.meta.isDefaultValue })}
              disabled={!bundle.isVirtual}
              name={field.name}
              fill
              value={field.state.value}
              onChange={(v) => field.handleChange(v.target.value)}
            />
          </FormGroup>
        )}
      />
      <form.Field
        name="preview"
        children={(field) => {
          return (
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
                        bundle.isVirtual
                          ? bundle.previewUrl
                          : `thumb://${bundle.id}?ver=${changedTime}`
                      }
                    />
                  </div>
                </ContextMenu>
                <InputGroup
                  inputRef={previewInputRef}
                  id="preview-input"
                  className={cn({ changed: !field.state.meta.isDefaultValue })}
                  inputClassName={cn({ dragging: isDragging, draggingOver: isDraggingOverPreview })}
                  disabled={!bundle.isVirtual}
                  name={field.name}
                  fill
                  value={isDragging ? 'DROP PREVIEW FILE HERE TO UPDATE' : field.state.value}
                  leftIcon={isDragging ? 'select' : undefined}
                  onChange={(v) => field.handleChange(v.target.value)}
                />
                {!bundle.isVirtual && (
                  <Button
                    disabled={!form.state.values.link}
                    onClick={() => downloadPreviewMutation(undefined)}
                    icon="import"
                    title="Download preview image from link and save it to disk"
                  >
                    Update Preview
                  </Button>
                )}
              </ControlGroup>
            </FormGroup>
          );
        }}
      />

      <form.Field
        name="description"
        children={({ name, state, handleChange }) => {
          return (
            <FormGroup label="Description">
              <TextArea
                name={name}
                maxLength={512}
                className={cn({ changed: !state.meta.isDefaultValue })}
                fill
                value={state.value}
                onChange={(v) => handleChange(v.target.value)}
              />
            </FormGroup>
          );
        }}
      />
      <form.Field
        name="link"
        children={(field) => {
          return (
            <FormGroup label="Link" labelFor={field.name}>
              <ControlGroup>
                <InputGroup
                  rightElement={<Warning errors={field.state.meta.errors} />}
                  type="url"
                  name={field.name}
                  className={cn({ changed: !field.state.meta.isDefaultValue })}
                  fill
                  value={field.state.value}
                  onChange={(v) => field.handleChange(v.target.value)}
                />
                <Button icon="link" onClick={() => window.open(field.state.value, '_blank')} />
              </ControlGroup>
            </FormGroup>
          );
        }}
      />
      <form.Field
        name="tags"
        children={(field) => {
          return (
            <FormGroup label="Tags">
              <TagInput
                values={field.state.value ?? []}
                onRemove={(tag, index) =>
                  field.handleChange((field.state.value ?? []).filter((t, i) => i !== index))
                }
                onAdd={(values) => field.handleChange([...(field.state.value ?? []), ...values])}
                className={cn({ changed: !field.state.meta.isDefaultValue })}
              />
            </FormGroup>
          );
        }}
      />
      <form.Subscribe
        children={({ canSubmit, isDefaultValue, isSubmitting, errors }) => {
          // eslint-disable-next-line react-hooks/rules-of-hooks
          const blocker = useBlocker(!isDefaultValue);
          return (
            <ButtonGroup>
              <Button
                icon="floppy-disk"
                type="submit"
                intent={!isDefaultValue ? 'success' : 'none'}
                disabled={!canSubmit || isDefaultValue || isDownloadingPreview}
                onClick={(e) => {
                  e.preventDefault();
                  form.handleSubmit();
                }}
              >
                {isSubmitting ? '...' : 'Save'}
              </Button>
              <Button
                disabled={isDefaultValue}
                onClick={(e) => {
                  e.preventDefault();
                  form.reset();
                }}
                icon="reset"
                type="reset"
              >
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
                <Button
                  endIcon="caret-down"
                  disabled={!form.state.values.link || importMutation.isPending}
                >
                  Import
                </Button>
              </Popover>
              <Button icon="trash" onClick={handleDeleteButton} intent="danger">
                Delete
              </Button>
              {errors.length > 0 && (
                <Tooltip
                  intent="danger"
                  content={
                    <ul className={Classes.LIST_UNSTYLED}>
                      {errors.map(
                        (e) =>
                          !!e &&
                          Object.keys(e).map((k) => (
                            <li>
                              <b>{k}</b>: {e[k].map((p) => p.message).join('\n')}
                            </li>
                          )),
                      )}
                    </ul>
                  }
                >
                  <Tag intent="danger" icon="error" />
                </Tooltip>
              )}
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
            </ButtonGroup>
          );
        }}
      />
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
    </div>
  );
}

export default BundleEditor;
