import { Menu, MenuItem } from '@blueprintjs/core';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';
import Split from 'react-split';
import { AppToaster } from 'renderer/toaster';
import FileInfoPanel from '../FileInfoPanel/FileInfoPanel';
import ExplorerBar from './ExplorerBar';

const Explorer = () => {
  const {
    files,
    setSelected,
    setExpanded,
    tags,
    typeFilter,
    selectedTags,
    toggleTag,
    toggleType,
    filter,
    setFilter,
    sideBarSize,
    setSideBarSize,
  } = useContext(AppContext);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleBundleCreateClick = useCallback(
    async (directory: string) => {
      window.api.createBundle(directory);
      queryClient.invalidateQueries(['files']);
    },
    [queryClient]
  );

  const handleBundleEdit = useCallback(
    (id: string) => {
      setSelected(id, true);
      navigate(`/bundles/${id}/edit`);
    },
    [setSelected, navigate]
  );

  const handleOpenPath = useCallback((path: string) => {
    window.api.openPath(path);
  }, []);

  const handleBundleMove = useCallback(
    async (path: string) => {
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
        setSelected(newPath, true);
        navigate(
          `/explorer/${encodeURIComponent(newPath)}?focus=${encodeURIComponent(
            newPath
          )}`
        );

        // Refetch to update the tree (simpler for context menu moves)
        queryClient.invalidateQueries(['files']);
        queryClient.invalidateQueries(['bundles']);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        AppToaster.show({
          message: `Failed to move bundle: ${message}`,
          intent: 'danger',
        });
      }
    },
    [queryClient, setSelected, navigate]
  );

  const contextMenu = (
    path: string,
    bundlePath: string | undefined,
    isDirectory: boolean
  ) => {
    if (isDirectory) {
      return (
        <Menu>
          <MenuItem
            disabled={!!bundlePath}
            icon="folder-new"
            text="Create Bundle"
            onClick={() => handleBundleCreateClick(path)}
          />
          <MenuItem
            disabled={!bundlePath}
            icon="edit"
            text="Edit Bundle"
            onClick={() => handleBundleEdit(path)}
          />
          <MenuItem
            icon="move"
            text="Move to..."
            onClick={() => handleBundleMove(path)}
          />
          <MenuItem
            icon="folder-open"
            text="Open Folder"
            onClick={() => handleOpenPath(path)}
          />
        </Menu>
      );
    }
    return (
      <Menu>
        <MenuItem
          icon="folder-open"
          text="Open Folder"
          onClick={() => handleOpenPath(path)}
        />
      </Menu>
    );
  };

  return (
    <>
      <Split
        direction="horizontal"
        cursor="col-resize"
        className="wrap"
        snapOffset={30}
        minSize={100}
        expandToMin={false}
        gutterSize={10}
        sizes={[sideBarSize, 100 - sideBarSize]}
        onDragEnd={(size) => {
          setSideBarSize(size[0]);
          window.sessionStorage.setItem('sideBarSize', String(size[0]));
        }}
      >
        <ExplorerBar
          typeFilter={typeFilter}
          toggleType={toggleType}
          selectedTags={selectedTags}
          toggleTag={toggleTag}
          files={files}
          setSelected={setSelected}
          setExpanded={setExpanded}
          tags={tags}
          filter={filter}
          setFilter={setFilter}
          contextMenu={contextMenu}
        />
        <FileInfoPanel
          panelSize={100 - sideBarSize}
          setSelected={setSelected}
          filter={filter}
          contextMenu={contextMenu}
        />
      </Split>
    </>
  );
};

export default Explorer;
