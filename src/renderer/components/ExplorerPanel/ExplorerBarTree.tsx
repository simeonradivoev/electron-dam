import {
  TreeNodeInfo,
  Tree,
  ContextMenu,
  Spinner
} from '@blueprintjs/core';
import { UseQueryResult } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { filterNodes } from 'renderer/scripts/file-tree';
import scrollIntoView from 'scroll-into-view-if-needed';

/**
 * This is where the tree view is rendered
 */
type Props = {
  files: UseQueryResult<TreeNodeInfo<FileTreeNode>[], unknown>;
  setSelected: (id: string | number, selected: boolean) => void;
  setExpanded: (nodePath: NodePath, expanded: boolean) => void;
  filter: string | undefined;
  contextMenu: (
    path: string,
    bundlePath: string | undefined,
    isDirectory: boolean
  ) => JSX.Element;
};

const ExplorerBarTree = ({
  files,
  setSelected,
  setExpanded,
  filter,
  contextMenu,
}: Props) => {
  const treeRef = useRef<Tree<FileTreeNode>>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = searchParams.get('focus');
  const navigate = useNavigate();

  const handleNodeClick = useCallback(
    (
      node: TreeNodeInfo,
      nodePath: NodePath,
      e: React.MouseEvent<HTMLElement>
    ) => {
      const originallySelected = node.isSelected;
      setSelected(node.id, !originallySelected);
      navigate(`/explorer/${encodeURIComponent(node.id)}`);
    },
    [setSelected, navigate]
  );

  const handleNodeDoubleClick = useCallback(
    (
      node: TreeNodeInfo,
      nodePath: NodePath,
      e: React.MouseEvent<HTMLElement>
    ) => {
      const originallySelected = node.isSelected;
      setSelected(node.id, !originallySelected);
      navigate({
        pathname: `/explorer/${encodeURIComponent(node.id)}`,
        search: `?autoPlay=${true}`,
      });
    },
    [navigate, setSelected]
  );

  const handleNodeCollapse = useCallback(
    (_node: TreeNodeInfo, nodePath: NodePath) => {
      setExpanded(nodePath, false);
    },
    [setExpanded]
  );

  const handleNodeExpand = useCallback(
    (_node: TreeNodeInfo, nodePath: NodePath) => {
      setExpanded(nodePath, true);
    },
    [setExpanded]
  );

  const handleContextMenu = useCallback(
    (
      _node: TreeNodeInfo<FileTreeNode>,
      nodePath: NodePath,
      e: React.MouseEvent<HTMLElement>
    ) => {
      ContextMenu.show(
        contextMenu(
          _node.nodeData?.path ?? '',
          _node.nodeData?.bundlePath,
          _node.nodeData?.isDirectory ?? true
        ),
        { left: e.clientX, top: e.clientY }
      );
    },
    [contextMenu]
  );

  useEffect(() => {
    const tree = document.getElementsByClassName('tree')[0];

    if (focus) {
      const scroll = async () => {
        // Wait for the tree to populate
        await new Promise((resolve) => setTimeout(resolve, 0));
        const element = treeRef.current?.getNodeContentElement(focus);
        if (element) {
          scrollIntoView(element, {
            block: 'nearest',
            inline: 'nearest',
            scrollMode: 'if-needed',
          });
        }
      };

      scroll();
    } else {
      const scroll = async () => {
        // Wait for the tree to populate
        await new Promise((resolve) => setTimeout(resolve, 0));

        const node = filterNodes(files.data, (n) => !!n.isSelected)[0];
        if (node) {
          const element = treeRef.current?.getNodeContentElement(node.id);
          if (element) {
            scrollIntoView(element, {
              block: 'nearest',
              inline: 'nearest',
              scrollMode: 'if-needed',
            });
          }
        }
      };

      scroll();
    }
  }, [focus, files.data, filter]);

  return files.isSuccess && !files.isFetching ? (
    <Tree<FileTreeNode>
      ref={treeRef}
      className="tree y-scroll"
      contents={files.data}
      onNodeClick={handleNodeClick}
      onNodeDoubleClick={handleNodeDoubleClick}
      onNodeCollapse={handleNodeCollapse}
      onNodeExpand={handleNodeExpand}
      onNodeContextMenu={handleContextMenu}
    />
  ) : (
    <div className="centered">
      <Spinner />
    </div>
  );
};

export default ExplorerBarTree;
