import {
  TreeNodeInfo,
  Tree,
  ContextMenu,
  Spinner,
  MenuItem,
  Menu,
} from '@blueprintjs/core';
import { UseQueryResult } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { filterNodes } from 'renderer/scripts/file-tree';

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
  const [focus, setFocus] = useState(searchParams.get('focus'));
  const navigate = useNavigate();

  const handleNodeClick = useCallback(
    (
      node: TreeNodeInfo,
      nodePath: NodePath,
      e: React.MouseEvent<HTMLElement>
    ) => {
      const originallySelected = node.isSelected;
      setSelected(node.id, !originallySelected);
      navigate(`/explorer/${node.id}`);
    },
    [setSelected, navigate]
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
        treeRef.current?.getNodeContentElement(focus)?.scrollIntoView();
      };

      scroll();
    } else {
      const scroll = async () => {
        // Wait for the tree to populate
        await new Promise((resolve) => setTimeout(resolve, 0));
        const node = filterNodes(files.data, (n) => !!n.isSelected)[0];
        if (node) {
          treeRef.current
            ?.getNodeContentElement(node.id)
            ?.scrollIntoView({ inline: 'center', block: 'center' });
        }
      };

      scroll();
    }
  }, [focus, !!files.data, filter]);

  return files.isSuccess && !files.isFetching ? (
    <Tree<FileTreeNode>
      ref={treeRef}
      className="tree y-scroll"
      contents={files.data}
      onNodeClick={handleNodeClick}
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
