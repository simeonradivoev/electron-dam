import {
  AsyncDataLoaderDataRef,
  asyncDataLoaderFeature,
  buildProxiedInstance,
  dragAndDropFeature,
  hotkeysCoreFeature,
  ItemInstance,
  keyboardDragAndDropFeature,
  propMemoizationFeature,
  searchFeature,
  SelectionDataRef,
  selectionFeature,
  Updater,
} from '@headless-tree/core';
import { useTree } from '@headless-tree/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Virtualizer } from '@tanstack/react-virtual';
import { dirname, join, normalize } from 'pathe';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ShowContextMenuParams } from 'renderer/@types/preload';
import { useApp } from 'renderer/contexts/AppContext';
import { QueryKeys } from 'renderer/scripts/utils';
import { FileType } from 'shared/constants';
import { useSessionStorage } from 'usehooks-ts';
import ExplorerBarSearch from './ExplorerBarSearch';
import ExplorerBarTree from './ExplorerBarTree';

interface ExplorerBarProps {
  focusedItem?: string;
  setFocusedItem: (id: string) => void;
  typeFilter: FileType[];
  contextMenu: (params: ShowContextMenuParams | undefined) => void;
  quickAction?: (e: KeyboardEvent) => void;
}

/** Parent of the search and tree */
function ExplorerBar({
  focusedItem,
  setFocusedItem,
  typeFilter,
  contextMenu,
  quickAction,
}: ExplorerBarProps) {
  const virtualizer = useRef<Virtualizer<HTMLDivElement, Element> | null>(null);
  const [loadingItemData, setLoadingItemData] = useState<string[]>([]);
  const [loadingItemChildrens, setLoadingItemChildrens] = useState<string[]>([]);
  const [selected, setSelected] = useSessionStorage<string[]>('selected', []);
  const { projectDirectory, filter } = useApp();
  const queryClient = useQueryClient();

  const { data: expanded } = useQuery<string[]>({
    queryKey: ['expanded'],
    placeholderData: [],
  });

  const { mutate: expandedMutate } = useMutation<string[], Error, string[]>({
    mutationKey: ['expanded'],
  });

  const handleSelection = useCallback(
    (itemsUpdater: Updater<string[]>) => {
      const items = itemsUpdater as string[];
      setSelected(items);
    },
    [setSelected],
  );

  const handleFocus = useCallback(
    (focus: Updater<string | null>) => {
      const path = focus as string;
      setFocusedItem(path);
    },
    [setFocusedItem],
  );

  const handleExpansion = useCallback(
    (itemsUpdater: Updater<string[]>) => expandedMutate(itemsUpdater as string[]),
    [expandedMutate],
  );

  const isSearching = !!filter || typeFilter.length > 0;
  const handleSearch = useCallback(
    (search: string, item: ItemInstance<FileTreeNode>) => {
      if (!!filter && !item.getItemName().toLowerCase().includes(filter)) {
        return false;
      }
      if (
        typeFilter.length > 0 &&
        (!item.getItemData().fileType || !typeFilter.includes(item.getItemData().fileType!))
      ) {
        return false;
      }
      return true;
    },
    [filter, typeFilter],
  );

  const tree = useTree<FileTreeNode>({
    state: {
      loadingItemData,
      loadingItemChildrens,
      selectedItems: selected,
      expandedItems: expanded,
      search: isSearching ? 's' : undefined,
      focusedItem,
    },
    ignoreHotkeysOnInputs: false,
    setLoadingItemData,
    setLoadingItemChildrens,
    isSearchMatchingItem: isSearching ? handleSearch : undefined,
    instanceBuilder: buildProxiedInstance,
    setSelectedItems: handleSelection,
    setExpandedItems: handleExpansion,
    setFocusedItem: handleFocus,
    rootItemId: '',
    scrollToItem: (item) => {
      virtualizer.current?.scrollToIndex(item.getItemMeta().index, { align: 'auto' });
    },
    getItemName: (item) => item.getItemData().name,
    isItemFolder: (item) => item.getItemData().isDirectory,
    createLoadingItemData: () => ({ name: 'Loading...', isDirectory: false }) as FileTreeNode,
    onLoadedItem: (itemId, item) => {
      // Scroll to element on first load
      if (focusedItem && itemId === focusedItem) {
        // Give time for the tree to make the instance element and for the virtualizer to populate
        setTimeout(() => {
          virtualizer.current?.scrollToIndex(tree.getItemInstance(itemId).getItemMeta().index, {
            align: 'center',
          });
        }, 500);
      }
    },
    dataLoader: {
      getItem: (itemId) =>
        window.api
          .getFile(itemId)
          .then((e) => e ?? ({ name: 'Missing' } as FileTreeNode))
          .catch((e) => {
            return { name: 'Error' } as FileTreeNode;
          }),
      getChildren: async (itemId) =>
        (await window.api.getFileChildrenPaths(itemId))?.map((i) => normalize(i)) ?? [],
      getChildrenWithData: async (itemId) => {
        const children = await window.api.getFileChildren(itemId).catch((e) => undefined);
        if (!children) return [];
        children.sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));
        return children.map((c) => {
          return { id: normalize(c.path), data: c };
        });
      },
    },
    indent: 20,
    hotkeys: {
      focusPreviousItem: {
        hotkey: 'ArrowUp',
        handler: () => tree.focusPreviousItem(),
      },
      focusNextItem: {
        hotkey: 'ArrowDown',
        handler: () => tree.focusNextItem(),
      },
      custom: {
        hotkey: 'KeyQ',
        handler: (e, tree) => {
          quickAction?.(e);
        },
      },
    },
    features: [
      asyncDataLoaderFeature,
      selectionFeature,
      hotkeysCoreFeature,
      propMemoizationFeature,
      searchFeature,
      dragAndDropFeature,
      keyboardDragAndDropFeature,
    ],
  });

  useEffect(() => {
    const handleAddedFile = (p: string) => {
      const path = normalize(p);

      const instance = tree.getItemInstance(path);
      instance?.invalidateItemData(true);
      instance?.invalidateChildrenIds(false);

      const parentDir = dirname(path);
      const parent = tree.getItemInstance(parentDir);
      if (parent) {
        const existingChildren = parent.getChildren();
        const childrenIds = existingChildren.map((c) => c.getId()).concat(path);
        childrenIds.sort();
        parent.updateCachedChildrenIds(childrenIds);
        if (childrenIds.length === 1) {
          parent.invalidateItemData();
        }
      }
    };

    const handleRemoved = (p: string) => {
      const path = normalize(p);
      const instance = tree.getItemInstance(path);
      const parentDir = dirname(path);
      const parent = tree.getItemInstance(parentDir);

      instance?.invalidateItemData(true);
      instance?.invalidateChildrenIds();

      if (parent) {
        const existingChildren = parent.getChildren();
        parent.invalidateItemData();
        const children = existingChildren.filter((c) => c.getId() !== path).map((c) => c.getId());
        children.sort();
        parent.updateCachedChildrenIds(children);
      }
    };

    const handleFileChanged = (p: string) => {
      const path = normalize(p);
      const instance = tree.getItemInstance(path);
      instance?.invalidateItemData(true);
      queryClient.invalidateQueries({ queryKey: [QueryKeys.metadata, path] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.tags, path] });
      queryClient.invalidateQueries({ queryKey: [QueryKeys.fileInfo, path] });
    };

    const clearOnFileChanged = window.apiCallbacks.fileChanged(handleFileChanged);
    const clearOnFileAdded = window.apiCallbacks.fileAdded(handleAddedFile);
    const clearOnFolderAdded = window.apiCallbacks.folderAdded(handleAddedFile);
    const clearOnFileUnlinked = window.apiCallbacks.fileUnlinked(handleRemoved);
    const clearOnFolderUnlinked = window.apiCallbacks.folderUnlinked(handleRemoved);

    return () => {
      clearOnFileAdded();
      clearOnFolderAdded();
      clearOnFileUnlinked();
      clearOnFolderUnlinked();
      clearOnFileChanged();
    };
  }, [projectDirectory, tree]);

  const handleRefresh = useCallback(() => {
    const treeDataRef = tree.getDataRef<AsyncDataLoaderDataRef>();

    function invalidateRecursively(itemId: string) {
      treeDataRef.current.childrenIds[itemId]?.forEach((childId) => {
        const childData = treeDataRef.current.itemData[childId];
        if (childData) {
          invalidateRecursively(childId);
        }
      });

      const itemData = treeDataRef.current.childrenIds[itemId];
      if (itemData) {
        const itemInstance = tree.getItemInstance(itemId);
        itemInstance.invalidateItemData();
        itemInstance.invalidateChildrenIds();
      }
    }

    invalidateRecursively(tree.getRootItem().getId());
  }, [tree]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLElement>, item: ItemInstance<FileTreeNode>) => {
      if (e.shiftKey) {
        item.selectUpTo(e.ctrlKey || e.metaKey);
      } else if (e.ctrlKey || e.metaKey) {
        item.toggleSelect();
      } else {
        tree.setSelectedItems([item.getItemMeta().itemId]);
      }

      if (!e.shiftKey) {
        tree.getDataRef<SelectionDataRef>().current.selectUpToAnchorId = item.getId();
      }

      item.setFocused();
      item.primaryAction();
    },
    [tree],
  );

  // Handle the exapnsion of items that the focused item needs to be seen
  useEffect(() => {
    if (focusedItem && expanded) {
      const newExpanded = [...expanded];
      let hadChanges = false;
      const pathArray = focusedItem.split('/');
      for (let i = 0; i < pathArray.length; i += 1) {
        const path = join(...pathArray.slice(0, -i));

        if (!newExpanded.includes(path)) {
          newExpanded?.push(path);
          hadChanges = true;
        }
      }

      if (hadChanges) {
        expandedMutate(newExpanded);
      }

      const treeItem = tree.getItemInstance(focusedItem);
      if (treeItem) {
        if (virtualizer.current) {
          virtualizer.current!.scrollToIndex(treeItem.getItemMeta().index);
        }
      }
    }
  }, [focusedItem, tree, virtualizer.current]);

  return (
    <div className="side-panel">
      <ExplorerBarSearch tree={tree} refresh={handleRefresh} />
      <ExplorerBarTree
        ref={virtualizer}
        isSearching={isSearching}
        tree={tree}
        contextMenu={contextMenu}
        onClick={handleClick}
      />
    </div>
  );
}

export default ExplorerBar;
