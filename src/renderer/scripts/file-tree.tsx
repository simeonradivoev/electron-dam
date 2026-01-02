import { IconName, Tree, TreeNodeInfo } from '@blueprintjs/core';
import { useQueryClient } from '@tanstack/react-query';
import { IDBPDatabase } from 'idb/with-async-ittr';
import { extname } from 'pathe';
import { useEffect } from 'react';
import { AudioFileFormat, ModelFormat, ImageFormat } from 'shared/constants';

const iconMap = new Map<string, IconName>([
  ...Object.values(AudioFileFormat).map((f) => [f, 'music'] as [string, IconName]),
  ...Object.values(ImageFormat).map((f) => [f, 'media'] as [string, IconName]),
  ...Object.values(ModelFormat).map((f) => [f, 'cube'] as [string, IconName]),
  ['.zip', 'compressed'],
]);

export const forEachParent = (
  nodePath: number[],
  nodes: TreeNodeInfo<FileTreeNode>[] | undefined,
  callback: (node: TreeNodeInfo<FileTreeNode>) => void,
) => {
  if (!nodes) {
    return;
  }

  nodePath.pop();

  while (nodePath.length > 0) {
    const parentNode = Tree.nodeFromPath(nodePath, nodes);
    if (parentNode) {
      callback(parentNode);
    }
    nodePath.pop();
  }
};

export const forEachNodeIndexed = (
  path: number[],
  nodes: TreeNodeInfo<FileTreeNode>[] | undefined,
  callback: (node: TreeNodeInfo<FileTreeNode>, path: number[]) => void,
) => {
  if (nodes === undefined) {
    return;
  }

  nodes.forEach((node, childIndex) => {
    const childPath = [...path, childIndex];
    callback(node, childPath);
    forEachNodeIndexed(childPath, node.childNodes, callback);
  });
};

export const getFirstSelected = (
  nodes: TreeNodeInfo<FileTreeNode>[] | undefined,
): TreeNodeInfo<FileTreeNode> | undefined => {
  if (nodes === undefined) {
    return undefined;
  }

  let selected: TreeNodeInfo<FileTreeNode> | undefined;
  nodes.forEach((node) => {
    if (node.isSelected) {
      selected = node;
    }
  });
  return selected;
};

export const forEachNode = (
  nodes: TreeNodeInfo<FileTreeNode>[] | undefined,
  callback: (node: TreeNodeInfo<FileTreeNode>) => void,
) => {
  if (nodes === undefined) {
    return;
  }

  nodes.forEach((node) => {
    callback(node);
    forEachNode(node.childNodes, callback);
  });
};

export const flattenNodes = (
  nodes: TreeNodeInfo<FileTreeNode>[] | undefined,
): TreeNodeInfo<FileTreeNode>[] => {
  const flatten: TreeNodeInfo<FileTreeNode>[] = [];
  forEachNode(nodes, (node) => {
    flatten.push(node);
  });
  return flatten;
};

export const filterNodes = (
  nodes: TreeNodeInfo<FileTreeNode>[] | undefined,
  filter: (node: TreeNodeInfo<FileTreeNode>) => boolean,
) => {
  const filteredNodes: TreeNodeInfo<FileTreeNode>[] = [];
  forEachNode(nodes, (node) => {
    if (filter(node)) {
      filteredNodes.push(node);
    }
  });
  return filteredNodes;
};

export const getIcon = (path: string | undefined): IconName => {
  if (!path) {
    return 'document';
  }

  const ext = extname(path).toLowerCase();
  return iconMap.get(ext) ?? 'document';
};

export async function LoadGlobalTags() {
  const { tags, count } = await window.api.getGlobalTags(32);
  tags.sort((lhs, rhs) => {
    const comparison = rhs.count - lhs.count;
    if (comparison === 0) {
      return rhs.tag.localeCompare(lhs.tag);
    }
    return comparison;
  });
  return { tags, count };
}

export const BuildNodeQueries = (
  projectDirectory: string | null | undefined,
  database: Promise<IDBPDatabase<FilesDB>>,
) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    queryClient.setQueryDefaults(['expanded'], {
      queryFn: async () => {
        const files = await database;
        const transactionSelected = files.transaction('expanded', 'readonly');
        const storeSelected = transactionSelected.objectStore('expanded');
        const keys = await storeSelected.getAllKeys();
        return keys;
      },
    });
    queryClient.setMutationDefaults<string[], Error, string[]>(['expanded'], {
      mutationFn: async (data) => {
        const files = await database;
        const transactionSelected = files.transaction('expanded', 'readwrite');
        const storeSelected = transactionSelected.objectStore('expanded');
        storeSelected.clear();
        return Promise.all(data.map((d) => storeSelected.add(true, d)));
      },
      onSuccess: (data, v, r, c) => {
        c.client.setQueryData(c.mutationKey as string[], data);
      },
    });
  }, [queryClient, projectDirectory, database]);
};
