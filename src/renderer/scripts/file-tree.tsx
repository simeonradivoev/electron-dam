import { IconName, Tree, TreeNodeInfo } from '@blueprintjs/core';
import { IDBPDatabase } from 'idb/with-async-ittr';
import {
  QueryClient,
  useMutation,
  UseMutationResult,
  useQuery,
  UseQueryResult,
} from '@tanstack/react-query';
import {
  AudioFileFormat,
  FileType,
  ModelFormat,
  TextureFormat,
} from 'shared/constants';

const iconMap = new Map<string, IconName>([
  ...Object.values(AudioFileFormat).map(
    (f) => [f, 'music'] as [string, IconName]
  ),
  ...Object.values(TextureFormat).map(
    (f) => [f, 'media'] as [string, IconName]
  ),
  ...Object.values(ModelFormat).map((f) => [f, 'cube'] as [string, IconName]),
]);

export const forEachParent = (
  nodePath: number[],
  nodes: TreeNodeInfo<FileTreeNode>[] | undefined,
  callback: (node: TreeNodeInfo<FileTreeNode>) => void
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
  callback: (node: TreeNodeInfo<FileTreeNode>, path: number[]) => void
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
  nodes: TreeNodeInfo<FileTreeNode>[] | undefined
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
  callback: (node: TreeNodeInfo<FileTreeNode>) => void
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
  nodes: TreeNodeInfo<FileTreeNode>[] | undefined
): TreeNodeInfo<FileTreeNode>[] => {
  const flatten: TreeNodeInfo<FileTreeNode>[] = [];
  forEachNode(nodes, (node) => {
    flatten.push(node);
  });
  return flatten;
};

export const filterNodes = (
  nodes: TreeNodeInfo<FileTreeNode>[] | undefined,
  filter: (node: TreeNodeInfo<FileTreeNode>) => boolean
) => {
  const filteredNodes: TreeNodeInfo<FileTreeNode>[] = [];
  forEachNode(nodes, (node) => {
    if (filter(node)) {
      filteredNodes.push(node);
    }
  });
  return filteredNodes;
};

export const GetProjectDirectory = async (): Promise<string | null> => {
  return window.api.getProjectDirectory();
};

const getIcon = (path: string): IconName => {
  const lastIndex = path.lastIndexOf('.');
  if (lastIndex >= 0) {
    const ext = path.substring(lastIndex);
    return iconMap.get(ext) ?? 'document';
  }

  return 'document';
};

const UpdateIcon = (node: TreeNodeInfo<FileTreeNode>) => {
  if (!node.nodeData) {
    return;
  }

  if (node.nodeData.bundlePath) {
    node.icon = 'box';
  } else if (node.nodeData.isDirectory) {
    node.icon = node.isExpanded ? 'folder-open' : 'folder-close';
  } else {
    node.icon = getIcon(node.nodeData.name);
  }
};

export const LoadFiles = async ({
  queryKey,
}: {
  queryKey: readonly [
    key: string,
    database: IDBPDatabase<FilesDB> | undefined,
    selectedTags: string[],
    typeFilter: FileType[],
    filter: string | undefined,
    projectDirectory: UseQueryResult<string | null> | undefined
  ];
}): Promise<TreeNodeInfo<FileTreeNode>[]> => {
  const [key, database, selectedTags, typeFilter, filter] = queryKey;

  const dirs = await window.api.getFiles(selectedTags, typeFilter, filter);

  const BuildTreNodesRec = async (
    fileNode: FileTreeNode,
    childFilter: (node: FileTreeNode) => boolean
  ): Promise<TreeNodeInfo<FileTreeNode>> => {
    const node: TreeNodeInfo<FileTreeNode> = {
      id: fileNode.path,
      label: fileNode.name,
      childNodes:
        fileNode.children.length > 0
          ? await Promise.all(
              fileNode.children
                .filter(childFilter)
                .map(async (child) => BuildTreNodesRec(child, childFilter))
            )
          : undefined,
      nodeData: fileNode,
    };

    const transaction = database?.transaction(
      ['selected', 'expanded'],
      'readonly'
    );
    const expandedStore = transaction?.objectStore('expanded');
    const selectedStore = transaction?.objectStore('selected');

    node.isSelected = !!(await selectedStore?.get(fileNode.path));
    node.isExpanded = !!(await expandedStore?.get(fileNode.path));

    UpdateIcon(node);

    return node;
  };

  const nodes = await Promise.all(
    dirs.map(async (dir) => BuildTreNodesRec(dir, (child) => !!dir))
  );

  return nodes;
};

export const BuildNodeQueries = (
  projectDirectory: UseQueryResult<string | null> | undefined,
  queryClient: QueryClient,
  selectedTags: string[],
  typeFilter: FileType[],
  filter: string | undefined,
  database: IDBPDatabase<FilesDB> | undefined,
  setFileInfo: (fileInfo: FileInfo | null) => void
): {
  nodes: UseQueryResult<TreeNodeInfo<FileTreeNode>[], unknown>;
  setSelected: (id: string | number, selected: boolean) => void;
  setExpandedMutation: UseMutationResult<
    TreeNodeInfo<FileTreeNode>[],
    unknown,
    {
      path: NodePath;
      expanded: boolean;
    },
    unknown
  >;
} => {
  const nodes = useQuery<
    TreeNodeInfo<FileTreeNode>[],
    unknown,
    TreeNodeInfo<FileTreeNode>[],
    [
      key: string,
      database: IDBPDatabase<FilesDB> | undefined,
      selectedTags: string[],
      typeFilter: FileType[],
      filter: string | undefined,
      projectDirectory: UseQueryResult<string | null> | undefined
    ]
  >(
    ['files', database, selectedTags, typeFilter, filter, projectDirectory],
    LoadFiles,
    {
      enabled: !!database && !!projectDirectory?.data,
      refetchOnWindowFocus: false,
      cacheTime: 0,
    }
  );

  const SetSelectedMutation = async (
    id: string | number,
    selected: boolean
  ): Promise<TreeNodeInfo<FileTreeNode>[] | undefined> => {
    const transactionExpanded = database?.transaction('expanded', 'readwrite');
    const transactionSelected = database?.transaction('selected', 'readwrite');
    const storeSelected = transactionSelected?.objectStore('selected');
    const storeExpanded = transactionExpanded?.objectStore('expanded');

    // const nodesCopy = structuredClone(nodes.data);

    setFileInfo(null);

    storeSelected?.clear();

    let node: TreeNodeInfo<FileTreeNode> | undefined;

    // TODO: Ensure all parents are expanded

    forEachNodeIndexed([], nodes.data, (n, path) => {
      if (id === n.id) {
        node = n;
        forEachParent(path, nodes.data, (n) => {
          if (!n.isExpanded) {
            n.isExpanded = true;
            storeExpanded?.put(true, n.nodeData?.path);
          }
        });
      }
      n.isSelected = id === n.id;
    });

    if (!node) {
      return;
    }

    // Force the file info to update
    const fileNode = node.nodeData as FileTreeNode;
    /* window.api
      .getFileDetails(fileNode.path)
      .then((fileInfo) => {
        setFileInfo(fileInfo);
        return fileInfo;
      })
      .catch((e) => console.error(e)); */

    // Update DB
    await storeSelected?.put(true, fileNode.path);
    return nodes.data ?? undefined;
  };

  const SetExpandedMutation = async (
    path: NodePath,
    expanded: boolean
  ): Promise<TreeNodeInfo<FileTreeNode>[]> => {
    // const nodesCopy = structuredClone(nodes.data);

    // Mark as expanded
    const node = Tree.nodeFromPath(path, nodes.data);
    node.isExpanded = expanded;
    UpdateIcon(node);

    // Update DB
    const fileNode = node.nodeData as FileTreeNode;
    const transaction = database?.transaction('expanded', 'readwrite');
    const store = transaction?.objectStore('expanded');
    await store?.put(expanded, fileNode.path);

    return nodes.data ?? [];
  };

  const setSelectedMutation = useMutation(
    ['files', database, projectDirectory],
    async ({
      id,
      selected,
    }: {
      id: string | number;
      selected: boolean;
    }): Promise<TreeNodeInfo<FileTreeNode>[] | undefined> =>
      SetSelectedMutation(id, selected),
    {
      onSuccess: (result) => {
        if (result) {
          queryClient.setQueriesData(
            ['files', database, selectedTags, typeFilter, projectDirectory],
            result
          );
        }
      },
    }
  );

  const setSelected = (id: string | number, selected: boolean) =>
    setSelectedMutation.mutate({
      id,
      selected,
    });

  const setExpandedMutation = useMutation(
    ['files', database, projectDirectory],
    async ({
      path,
      expanded,
    }: {
      path: NodePath;
      expanded: boolean;
    }): Promise<TreeNodeInfo<FileTreeNode>[]> =>
      SetExpandedMutation(path, expanded),
    {
      onSuccess: (result) => {
        queryClient.setQueriesData(
          ['files', database, selectedTags, typeFilter, projectDirectory],
          result
        );
      },
    }
  );
  return { nodes, setSelected, setExpandedMutation };
};
