import { Icon, IconName } from '@blueprintjs/core';
import { HotkeysCoreDataRef, ItemInstance, TreeInstance } from '@headless-tree/core';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import cn from 'classnames';
import React, {
  forwardRef,
  useCallback,
  Key,
  useImperativeHandle,
  useRef,
  useMemo,
  memo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ShowContextMenuParams } from 'renderer/@types/preload';
import { getIcon } from 'renderer/scripts/file-tree';

/**
 * This is where the tree view is rendered
 */
type Props = {
  tree: TreeInstance<FileTreeNode>;
  isSearching: boolean;
  contextMenu: (params: ShowContextMenuParams | undefined) => void;
  onClick: (e: React.MouseEvent<HTMLElement>, i: ItemInstance<FileTreeNode>) => void;
};

type TreeItemProps = {
  name: string;
  expand: () => void;
  collapse: () => void;
  isExpanded: boolean;
  searchMatch: boolean;
  nodeData: FileTreeNode;
  isSelected: boolean;
  contextMenu: (params: ShowContextMenuParams | undefined) => void;
  indent: number;
  isFocused: boolean;
  onCustomClick: (e: React.MouseEvent<HTMLElement>) => void;
  isSearching: boolean;
  virtualItemStart: number;
  onDoubleClick: () => void;
  dragLineStyle: any;
};

const TreeItem = memo(
  ({
    name,
    expand,
    collapse,
    isExpanded,
    onCustomClick,
    nodeData,
    isSelected,
    contextMenu,
    indent,
    searchMatch,
    isSearching,
    virtualItemStart,
    onDoubleClick,
    isFocused,
    dragLineStyle,
  }: TreeItemProps) => {
    const iconElement = useMemo(() => {
      let icon: IconName;
      if (nodeData.isDirectory) {
        if (nodeData.isArchived && nodeData.bundlePath) {
          icon = 'compressed';
        } else if (nodeData.bundlePath) {
          icon = 'box';
        } else if (!nodeData.isEmpty && isExpanded) {
          icon = 'folder-open';
        } else {
          icon = 'folder-close';
        }
      } else {
        icon = getIcon(nodeData.path);
      }

      return (
        <Icon
          intent={searchMatch ? 'primary' : 'none'}
          className="bp6-tree-node-icon"
          icon={icon}
        />
      );
    }, [
      isExpanded,
      nodeData.bundlePath,
      nodeData.isArchived,
      nodeData.isDirectory,
      nodeData.isEmpty,
      nodeData.path,
      searchMatch,
    ]);
    return (
      <li
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          transform: `translateY(${virtualItemStart}px)`,
        }}
        role="treeitem"
        aria-selected
        onClick={onCustomClick}
        onContextMenu={(e: React.MouseEvent<HTMLLIElement>) => {
          if (!isSelected) {
            onCustomClick(e);
          }
          contextMenu({
            id: nodeData.path,
            rect: new DOMRect(e.clientX, e.clientY, 16, 16),
          });
        }}
        onDoubleClick={onDoubleClick}
        className={cn('bp6-tree-node', {
          'bp6-tree-node-selected': isFocused,
          'bp6-disabled': isSearching && !searchMatch,
          'multi-selection': isSelected,
        })}
      >
        <div className={cn(`bp6-tree-node-content bp6-tree-node-content-${indent}`, {})}>
          {nodeData.isDirectory ? (
            <>
              <Icon
                icon="chevron-right"
                role="presentation"
                className={cn({
                  'bp6-tree-node-caret-open': !nodeData.isEmpty && isExpanded,
                  'bp6-tree-node-caret': !nodeData.isEmpty,
                  'bp6-tree-node-caret-none': nodeData.isEmpty,
                })}
                onClick={
                  nodeData.isEmpty
                    ? undefined
                    : (e) => {
                        e.stopPropagation();
                        if (isExpanded) collapse();
                        else expand();
                      }
                }
              />
              {iconElement}
            </>
          ) : (
            <>
              <span className="bp6-tree-node-caret-none" />
              {iconElement}
            </>
          )}

          <span className="bp6-tree-node-label">{name}</span>
          {searchMatch && <Icon icon="search" />}
        </div>
        <div style={dragLineStyle} className="dragline" />
      </li>
    );
  },
);

const Inner = forwardRef<Virtualizer<HTMLDivElement, Element>, Props>(
  ({ tree, isSearching, onClick, contextMenu }, ref) => {
    const parentRef = useRef<HTMLDivElement | null>(null);

    const navigate = useNavigate();

    const handleNodeDoubleClick = useCallback(
      (node: FileTreeNode) => {
        navigate({
          pathname: `/explorer/${encodeURIComponent(node.path)}`,
          search: `?autoPlay=${true}`,
        });
      },
      [navigate],
    );

    const virtualizer = useVirtualizer({
      count: tree.getItems().length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 30,
    });

    useImperativeHandle(ref, () => virtualizer);

    return (
      <div
        ref={parentRef}
        tabIndex={-1}
        className="tree-parent y-scroll"
        role="tree"
        onKeyDown={(e) => {
          e.preventDefault();
          tree
            .getDataRef<HotkeysCoreDataRef>()
            .current.keydownHandler?.(e as unknown as KeyboardEvent);
        }}
        onKeyUp={(e) => {
          e.preventDefault();
          tree
            .getDataRef<HotkeysCoreDataRef>()
            .current.keyupHandler?.(e as unknown as KeyboardEvent);
        }}
        onBlur={(e) => {
          e.preventDefault();
          tree.getDataRef<HotkeysCoreDataRef>().current.resetHandler?.(e as unknown as FocusEvent);
        }}
      >
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
          className="bp6-tree tree bp6-elevation-0"
        >
          <ul className="bp6-tree-node-list bp6-tree-root" {...tree.getContainerProps('files')}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = tree.getItems()[virtualItem.index];
              return (
                <TreeItem
                  data-index={virtualItem.index}
                  dragLineStyle={tree.getDragLineStyle()}
                  key={virtualItem.key as Key}
                  onCustomClick={(e: React.MouseEvent<HTMLElement>) => {
                    onClick(e, item);
                  }}
                  isSelected={item.isSelected()}
                  searchMatch={item.isMatchingSearch()}
                  name={item.getItemName()}
                  nodeData={item.getItemData()}
                  expand={item.expand}
                  collapse={item.collapse}
                  isExpanded={item.isExpanded()}
                  isFocused={item.isFocused()}
                  contextMenu={contextMenu}
                  indent={item.getItemMeta().level}
                  onDoubleClick={() => handleNodeDoubleClick(item.getItemData())}
                  isSearching={isSearching}
                  virtualItemStart={virtualItem.start}
                />
              );
            })}
          </ul>
        </div>
      </div>
    );
  },
);

export default Inner;
