import { Menu, MenuDivider, Spinner } from '@blueprintjs/core';
import { MenuItem2, Tooltip2 } from '@blueprintjs/popover2';
import { useIsMutating, useMutation, useQuery } from '@tanstack/react-query';
import { normalize } from 'pathe';
import { useCallback } from 'react';
import { NavigateFunction, useNavigate } from 'react-router-dom';
import { QueryKeys } from 'renderer/scripts/utils';
import { AppToaster } from 'renderer/toaster';
import { AutoTagType, ImportType } from 'shared/constants';

interface Params {
  assetPath: string;
  isDirectory?: boolean;
  hasBundlePath?: boolean;
  navigate: NavigateFunction;
}

export default function FileContextMenu({
  assetPath,
  isDirectory: isDirectoryParam,
  hasBundlePath: hasBundlePathParam,
  navigate,
}: Params) {
  const handleOpenPath = useCallback((path: string) => {
    window.api.openPath(path);
  }, []);

  const hasBundleOp = useIsMutating({ mutationKey: ['bundle-op'] }) > 0;
  const hasMetadataOp = useIsMutating({ mutationKey: [QueryKeys.metadata] }) > 0;

  const { mutate: handleBundleCreate, isPending: isCreatingBundle } = useMutation({
    mutationKey: ['bundle-op', 'create'],
    mutationFn: async (directory: string) => {
      window.api.createBundle(directory);
    },
  });

  const { data: nodeData, isFetching } = useQuery({
    enabled: !isDirectoryParam || !hasBundlePathParam,
    queryKey: ['context-asset-node', assetPath],
    queryFn: () => window.api.getFile(assetPath),
  });

  const isDirectory = isDirectoryParam ?? nodeData?.isDirectory;
  const hasBundlePath = hasBundlePathParam ?? nodeData?.bundlePath;

  const { data: canGenerateOllamaMetadata } = useQuery({
    queryKey: ['can-generate-metadata', assetPath, AutoTagType.Ollama],
    queryFn: () => window.api.canGenerateMetadata(assetPath, AutoTagType.Ollama),
  });

  const { data: canGenerateTransformersMetadata } = useQuery({
    queryKey: ['can-generate-metadata', assetPath, AutoTagType.Transformers],
    queryFn: () => window.api.canGenerateMetadata(assetPath, AutoTagType.Transformers),
  });

  const handleBundleEdit = useCallback(
    (id: string) => {
      navigate(`/bundles/${id}/edit`);
    },
    [navigate],
  );

  const { mutate: handleBundleMove } = useMutation({
    mutationKey: ['bundle-op', 'move'],
    mutationFn: async (path: string, context) => {
      try {
        const newParentDir = await window.api.selectProjectDirectory();
        if (!newParentDir) return;

        const folderName = path.split(/[/\\]/).pop();
        if (!folderName) return;

        const separator = newParentDir.includes('\\') ? '\\' : '/';
        const newPath = `${newParentDir}${separator}${folderName}`;

        if (path === newPath) return;

        await window.api.moveBundle(path, newPath);

        // Select and navigate to the moved bundle
        navigate(`/explorer/${encodeURIComponent(newPath)}`);

        // Refetch to update the tree (simpler for context menu moves)
        context.client.invalidateQueries({ queryKey: ['files'] });
        context.client.invalidateQueries({ queryKey: ['bundles'] });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        AppToaster.show({
          message: `Failed to move bundle: ${message}`,
          intent: 'danger',
        });
      }
    },
  });

  const { mutate: handleExport, isPending: isExporting } = useMutation({
    mutationKey: ['bundle-op', 'export'],
    mutationFn: (path: string) => window.api.exportBundle(path),
    scope: {
      id: 'export',
    },
  });

  const embeddingsMutation = useMutation({
    mutationFn: () => (assetPath ? window.api.generateEmbeddings(assetPath) : Promise.reject()),
    onSuccess: (d, v, r, context) => {
      context.client.invalidateQueries({ queryKey: [QueryKeys.metadata, assetPath] });
    },
    mutationKey: ['embeddings', assetPath],
  });

  const autoMetadataMutation = useMutation({
    mutationKey: [QueryKeys.metadata, assetPath, 'generate'],
    mutationFn: async ({ type, missingOnly }: { type: AutoTagType; missingOnly: boolean }) =>
      assetPath ? window.api.autoMetadata(assetPath, type, missingOnly) : Promise.reject(),
    onError: (o) => {
      AppToaster.show({ message: o.message, intent: 'danger' });
    },
    onSuccess: (_d, v, r, context) => {
      if (assetPath) {
        context.client.invalidateQueries({ queryKey: [QueryKeys.tags, normalize(assetPath)] });
        context.client.invalidateQueries({ queryKey: [QueryKeys.metadata, normalize(assetPath)] });
      }
    },
  });

  const removeDescriptions = useMutation({
    mutationKey: [QueryKeys.metadata, assetPath, 'remove', 'description'],
    mutationFn: async () =>
      assetPath ? window.api.removeDescription(assetPath) : Promise.reject(),
    onError: (o) => {
      AppToaster.show({ message: o.message, intent: 'danger' });
    },
    onSuccess: (_d, v, r, context) => {
      if (assetPath) {
        context.client.invalidateQueries({ queryKey: [QueryKeys.metadata, normalize(assetPath)] });
      }
    },
  });

  const removeTags = useMutation({
    mutationKey: [QueryKeys.metadata, assetPath, 'remove', QueryKeys.tags],
    mutationFn: async () => (assetPath ? window.api.removeAllTags(assetPath) : Promise.reject()),
    onError: (o) => {
      AppToaster.show({ message: o.message, intent: 'danger' });
    },
    onSuccess: (_d, v, r, context) => {
      if (assetPath) {
        context.client.invalidateQueries({ queryKey: [QueryKeys.tags, normalize(assetPath)] });
      }
    },
  });

  const describeMenu = (
    <MenuItem2 text={isDirectory ? 'Describe All' : 'Describe'} icon="barcode">
      <Tooltip2
        content="The best accurate but requires you have ollama installed and running. This will regenerate only missing metadata"
        hoverOpenDelay={2000}
      >
        <MenuItem2
          icon="predictive-analysis"
          disabled={!canGenerateOllamaMetadata || hasMetadataOp}
          text="Ollama"
          onClick={() =>
            autoMetadataMutation.mutate({ type: AutoTagType.Ollama, missingOnly: true })
          }
        />
      </Tooltip2>
      <Tooltip2
        content="The best accurate but requires you have ollama installed and running. This will regenerated all metadata."
        hoverOpenDelay={2000}
      >
        <MenuItem2
          icon="predictive-analysis"
          disabled={!canGenerateOllamaMetadata || hasMetadataOp}
          text="Ollama (Forced)"
          onClick={() =>
            autoMetadataMutation.mutate({ type: AutoTagType.Ollama, missingOnly: false })
          }
        />
      </Tooltip2>
      <Tooltip2
        content="Describe the item using simple transformers. This often is inaccurate but good enough for semantic search. This will regenerate only missing metadata."
        hoverOpenDelay={2000}
      >
        <MenuItem2
          disabled={!canGenerateTransformersMetadata || hasMetadataOp}
          text="Transformers"
          onClick={() =>
            autoMetadataMutation.mutate({ type: AutoTagType.Transformers, missingOnly: true })
          }
        />
      </Tooltip2>
      <Tooltip2
        content="Describe the item using simple transformers. This often is inaccurate but good enough for semantic search. This will regenerated all metadata."
        hoverOpenDelay={2000}
      >
        <MenuItem2
          disabled={!canGenerateTransformersMetadata || hasMetadataOp}
          text="Transformers (Forced)"
          onClick={() =>
            autoMetadataMutation.mutate({ type: AutoTagType.Transformers, missingOnly: false })
          }
        />
      </Tooltip2>
    </MenuItem2>
  );
  const embeddingMenu = (
    <Tooltip2
      content="Embedding help searching by semantic meaning. You need a description of the asset to generate them"
      hoverOpenDelay={2000}
    >
      <MenuItem2
        disabled={embeddingsMutation.isPending}
        text="Generate Embeddings"
        icon="predictive-analysis"
        onClick={() => embeddingsMutation.mutate()}
      />
    </Tooltip2>
  );
  const clearMenu = (
    <MenuItem2 icon="eraser" text="Clear">
      <Tooltip2 content="Will remove all generated descriptions" hoverOpenDelay={2000}>
        <MenuItem2
          disabled={removeDescriptions.isPending || hasMetadataOp}
          icon="predictive-analysis"
          text="Description"
          onClick={() => removeDescriptions.mutate()}
        />
      </Tooltip2>
      <Tooltip2 content="Will remove all tags" hoverOpenDelay={2000}>
        <MenuItem2
          disabled={removeDescriptions.isPending || hasMetadataOp}
          icon="tag"
          text="Tags"
          onClick={() => removeTags.mutate()}
        />
      </Tooltip2>
    </MenuItem2>
  );

  if (isFetching) {
    return (
      <Menu>
        <Spinner />
      </Menu>
    );
  }
  if (isDirectory) {
    return (
      <Menu>
        <MenuItem2
          disabled={!!hasBundlePath || hasBundleOp}
          active={isCreatingBundle}
          icon="folder-new"
          text="Create Bundle"
          onClick={() => handleBundleCreate(assetPath)}
        />
        <MenuItem2
          disabled={!hasBundlePath || hasBundleOp}
          icon="edit"
          text="Edit Bundle"
          onClick={() => handleBundleEdit(assetPath)}
        />
        <MenuItem2
          icon="move"
          disabled={hasBundleOp}
          text="Move to..."
          onClick={() => handleBundleMove(assetPath)}
        />
        <MenuItem2
          disabled={hasBundleOp}
          active={isExporting}
          icon="export"
          text="Export"
          onClick={() => handleExport(assetPath)}
        />
        <MenuItem2
          icon="folder-open"
          text="Open Folder"
          onClick={() => handleOpenPath(assetPath)}
        />
        <MenuDivider />
        {describeMenu}
        {clearMenu}
        {embeddingMenu}
      </Menu>
    );
  }
  return (
    <Menu>
      <MenuItem2 icon="folder-open" text="Open Folder" onClick={() => handleOpenPath(assetPath)} />
      <MenuDivider />
      {describeMenu}
      {clearMenu}
      {embeddingMenu}
    </Menu>
  );
}
