import { Menu } from '@blueprintjs/core';
import { MenuItem2 } from '@blueprintjs/popover2';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext, useEffect, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import Split from 'react-split';
import { ContextMenuBuilder } from 'renderer/@types/preload';
import { useApp } from 'renderer/contexts/AppContext';
import { AppToaster } from 'renderer/toaster';
import FileInfoPanel from '../FileInfoPanel/FileInfoPanel';
import ExplorerBar from './ExplorerBar';

function Explorer() {
  const { viewInExplorer, focusedItem, typeFilter, sideBarSize, setSideBarSize } = useApp();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const hasBundleOp = useIsMutating({ mutationKey: ['bundle-op'] }) > 0;
  const { mutateAsync: setSelectedAsync } = useMutation<string[], Error, string[]>({
    mutationKey: ['selected'],
  });

  const { mutate: handleBundleCreate, isPending: isCreatingBundle } = useMutation({
    mutationKey: ['bundle-op', 'create'],
    mutationFn: async (directory: string) => {
      window.api.createBundle(directory);
    },
  });

  const handleBundleEdit = useCallback(
    (id: string) => {
      navigate(`/bundles/${id}/edit`);
    },
    [navigate],
  );

  const handleOpenPath = useCallback((path: string) => {
    window.api.openPath(path);
  }, []);

  const handleQuickAction = useCallback((e: KeyboardEvent) => {
    document.dispatchEvent(new CustomEvent('quickAction', { detail: e }));
  }, []);

  const { mutate: handleBundleMove } = useMutation({
    mutationKey: ['bundle-op', 'move'],
    mutationFn: async (path: string) => {
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
        await setSelectedAsync([newPath]);
        navigate(`/explorer/${encodeURIComponent(newPath)}`);

        // Refetch to update the tree (simpler for context menu moves)
        queryClient.invalidateQueries({ queryKey: ['files'] });
        queryClient.invalidateQueries({ queryKey: ['bundles'] });
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

  const contextMenu: ContextMenuBuilder = (path, hasBundlePath, isDirectory) => {
    if (isDirectory) {
      return (
        <Menu>
          <MenuItem2
            disabled={!!hasBundlePath || hasBundleOp}
            active={isCreatingBundle}
            icon="folder-new"
            text="Create Bundle"
            onClick={() => handleBundleCreate(path)}
          />
          <MenuItem2
            disabled={!hasBundlePath || hasBundleOp}
            icon="edit"
            text="Edit Bundle"
            onClick={() => handleBundleEdit(path)}
          />
          <MenuItem2
            icon="move"
            disabled={hasBundleOp}
            text="Move to..."
            onClick={() => handleBundleMove(path)}
          />
          <MenuItem2
            disabled={hasBundleOp}
            active={isExporting}
            icon="export"
            text="Export"
            onClick={() => handleExport(path)}
          />
          <MenuItem2 icon="folder-open" text="Open Folder" onClick={() => handleOpenPath(path)} />
        </Menu>
      );
    }
    return (
      <Menu>
        <MenuItem2 icon="folder-open" text="Open Folder" onClick={() => handleOpenPath(path)} />
      </Menu>
    );
  };

  return (
    <Split
      direction="horizontal"
      cursor="col-resize"
      className="wrap"
      snapOffset={30}
      minSize={100}
      expandToMin={false}
      gutterSize={5}
      sizes={[sideBarSize, 100 - sideBarSize]}
      onDragEnd={(size) => {
        setSideBarSize(size[0]);
        window.sessionStorage.setItem('sideBarSize', String(size[0]));
      }}
    >
      <ExplorerBar
        focusedItem={focusedItem}
        setFocusedItem={(e) => viewInExplorer(e as string)}
        typeFilter={typeFilter}
        contextMenu={contextMenu}
        quickAction={handleQuickAction}
      />
      <FileInfoPanel item={focusedItem} contextMenu={contextMenu} />
    </Split>
  );
}

export default Explorer;
