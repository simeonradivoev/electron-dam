import { Icon, IconName } from '@blueprintjs/core';
import { showContextMenu } from '@blueprintjs/popover2';
import { ItemInstance, TreeInstance } from '@headless-tree/core';
import { useVirtualizer, VirtualItem, Virtualizer } from '@tanstack/react-virtual';
import cn from 'classnames';
import React, {
  forwardRef,
  useCallback,
  Key,
  useImperativeHandle,
  useRef,
  useEffect,
  useMemo,
  memo,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { ContextMenuBuilder } from 'renderer/@types/preload';
import { getIcon } from 'renderer/scripts/file-tree';

/**
 * This is where the tree view is rendered
 */
type Props = {
  tree: TreeInstance<FileTreeNode>;
  isSearching: boolean;
  contextMenu: ContextMenuBuilder;
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
  context: () => JSX.Element;
  indent: number;
  isFocused: boolean;
  onCustomClick: (e: React.MouseEvent<HTMLElement>) => void;
  isSearching: boolean;
  virtualItemStart: number;
  onDoubleClick: () => void;
  dragLineStyle: any;
  props: Record<string, any>;
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
    context,
    indent,
    searchMatch,
    isSearching,
    virtualItemStart,
    onDoubleClick,
    isFocused,
    dragLineStyle,
    props,
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
          className="bp4-tree-node-icon"
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
        {...props}
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
          showContextMenu({
            content: context(),
            targetOffset: { left: e.clientX, top: e.clientY },
          });
        }}
        onDoubleClick={onDoubleClick}
        className={cn('bp4-tree-node', {
          'bp4-tree-node-selected': isFocused,
          'bp4-disabled': isSearching && !searchMatch,
          'multi-selection': isSelected,
        })}
      >
        <div className={cn(`bp4-tree-node-content bp4-tree-node-content-${indent}`, {})}>
          {nodeData.isDirectory ? (
            <>
              <span
                role="presentation"
                className={cn('bp4-icon-standard', {
                  'bp4-tree-node-caret-open': !nodeData.isEmpty && isExpanded,
                  'bp4-tree-node-caret': !nodeData.isEmpty,
                  'bp4-tree-node-caret-none': nodeData.isEmpty,
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
              <span className="bp4-tree-node-caret-none" />
              {iconElement}
            </>
          )}

          <span className="bp4-tree-node-label">{name}</span>
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
      <div ref={parentRef} className="tree-parent y-scroll" onKeyDown={(e) => e.preventDefault()}>
        <div
          style={{
            height: `${virtualizer.getTotalSize()}px`,
            position: 'relative',
          }}
          className="bp4-tree tree bp4-elevation-0"
        >
          <ul
            role="tree"
            className="bp4-tree-node-list bp4-tree-root"
            {...tree.getContainerProps()}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = tree.getItems()[virtualItem.index];
              const props = item.getProps();
              return (
                <TreeItem
                  props={props}
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
                  context={() =>
                    contextMenu(
                      item.getId(),
                      item.getItemData().bundlePath,
                      item.getItemData().isDirectory ?? true,
                    )
                  }
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
