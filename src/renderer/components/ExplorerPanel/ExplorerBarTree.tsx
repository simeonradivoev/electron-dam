import { TreeNodeInfo, Tree, ContextMenu, Spinner } from '@blueprintjs/core';
import { UseQueryResult, useQueryClient } from '@tanstack/react-query';
import React, { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { filterNodes } from 'renderer/scripts/file-tree';
import scrollIntoView from 'scroll-into-view-if-needed';
import { AppToaster } from 'renderer/toaster';

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
  const [searchParams] = useSearchParams();
  const focus = searchParams.get('focus');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleDragEnd = useCallback(
    async (event: { active: { id: string }; over: { id: string } }) => {
      const { active, over } = event;

      if (!over || active.id === over.id) return;

      const sourcePath = active.id as string;
      const targetPath = over.id as string;

      try {
        // Extract folder name from source path
        const folderName = sourcePath.split(/[/\\]/).pop();
        if (!folderName) return;

        // Construct new path
        const separator = targetPath.includes('\\') ? '\\' : '/';
        const newPath = `${targetPath}${separator}${folderName}`;

        if (sourcePath === newPath) return;

        await window.api.moveBundle(sourcePath, newPath);

        // Invalidate to refresh the tree
        queryClient.invalidateQueries(['files']);
        queryClient.invalidateQueries(['bundles']);

        // Select and navigate to the moved bundle after a small delay to let the tree update
        setTimeout(() => {
          setSelected(newPath, true);
          navigate(
            `/explorer/${encodeURIComponent(
              newPath
            )}?focus=${encodeURIComponent(newPath)}`
          );
        }, 100);
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        AppToaster.show({
          message: `Failed to move: ${message}`,
          intent: 'danger',
        });
      }
    },
    [queryClient, setSelected, navigate]
  );

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

  // Attach draggable/droppable to tree nodes
  useEffect(() => {
    const treeElement = document.querySelector('.tree');
    if (!treeElement || !files.data) return;

    // BlueprintJS renders nodes with class bp4-tree-node-content
    const nodes = treeElement.querySelectorAll('.bp4-tree-node-content');

    const nodeMap = new Map<HTMLElement, string>();

    // Build a map of HTML elements to node IDs by traversing the tree data
    const buildNodeMap = (
      treeNodes: TreeNodeInfo<FileTreeNode>[] | undefined
    ) => {
      if (!treeNodes) return;
      treeNodes.forEach((treeNode) => {
        // Match by node ID which is the path
        nodes.forEach((domNode) => {
          const htmlNode = domNode as HTMLElement;
          const labelElement = htmlNode.querySelector('.bp4-tree-node-label');
          // Check if this DOM node matches the tree node by checking if we haven't already mapped it
          // and if the label matches (use as fallback identifier)
          if (
            labelElement &&
            labelElement.textContent === treeNode.label &&
            !nodeMap.has(htmlNode) &&
            treeNode.nodeData?.path
          ) {
            // Use the node's ID (path) for drag-drop operations
            nodeMap.set(htmlNode, treeNode.id as string);
          }
        });
        if (treeNode.childNodes) {
          buildNodeMap(treeNode.childNodes);
        }
      });
    };

    buildNodeMap(files.data);

    // Now attach drag handlers to nodes we've mapped
    nodeMap.forEach((nodePath, htmlNode) => {
      // Only make directories draggable
      htmlNode.setAttribute('draggable', 'true');
      htmlNode.style.cursor = 'grab';

      const handleDragStart2 = (e: DragEvent) => {
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', nodePath);
        }
        htmlNode.style.opacity = '0.5';
      };

      const handleDragEnd2 = () => {
        htmlNode.style.opacity = '1';
      };

      const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'move';
        }
        htmlNode.style.background = 'rgba(19, 124, 189, 0.2)';

        // Auto-scroll when dragging near edges
        const SCROLL_ZONE = 50; // pixels from edge to trigger scroll
        const SCROLL_SPEED = 10; // pixels to scroll per interval

        const treeRect = treeElement.getBoundingClientRect();
        const mouseY = e.clientY;

        // Calculate distance from top and bottom
        const distanceFromTop = mouseY - treeRect.top;
        const distanceFromBottom = treeRect.bottom - mouseY;

        // Scroll up if near top
        if (distanceFromTop < SCROLL_ZONE && distanceFromTop > 0) {
          treeElement.scrollTop -= SCROLL_SPEED;
        }
        // Scroll down if near bottom
        else if (distanceFromBottom < SCROLL_ZONE && distanceFromBottom > 0) {
          treeElement.scrollTop += SCROLL_SPEED;
        }
      };

      const handleDragLeave = () => {
        htmlNode.style.background = '';
      };

      const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        htmlNode.style.background = '';

        const sourceId = e.dataTransfer?.getData('text/plain');
        if (sourceId && sourceId !== nodePath) {
          handleDragEnd({
            active: { id: sourceId },
            over: { id: nodePath },
          });
        }
      };

      htmlNode.addEventListener('dragstart', handleDragStart2);
      htmlNode.addEventListener('dragend', handleDragEnd2);
      htmlNode.addEventListener('dragover', handleDragOver);
      htmlNode.addEventListener('dragleave', handleDragLeave);
      htmlNode.addEventListener('drop', handleDrop);

      // Store handlers for cleanup
      // eslint-disable-next-line no-underscore-dangle
      (htmlNode as any).__handlers = {
        handleDragStart2,
        handleDragEnd2,
        handleDragOver,
        handleDragLeave,
        handleDrop,
      };
    });

    return () => {
      nodeMap.forEach((nodePath, htmlNode) => {
        // eslint-disable-next-line no-underscore-dangle
        const handlers = (htmlNode as any).__handlers;
        if (handlers) {
          htmlNode.removeEventListener('dragstart', handlers.handleDragStart2);
          htmlNode.removeEventListener('dragend', handlers.handleDragEnd2);
          htmlNode.removeEventListener('dragover', handlers.handleDragOver);
          htmlNode.removeEventListener('dragleave', handlers.handleDragLeave);
          htmlNode.removeEventListener('drop', handlers.handleDrop);
        }
      });
    };
  }, [files.data, handleDragEnd]);

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
