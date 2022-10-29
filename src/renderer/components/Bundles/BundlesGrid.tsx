import { TreeNodeInfo } from '@blueprintjs/core';
import { UseQueryResult } from '@tanstack/react-query';

import { useEffect, useState } from 'react';
import { forEachNode } from 'renderer/scripts/file-tree';
import Bundle from './Bundle';

type Props = {
  files: UseQueryResult<TreeNodeInfo<FileTreeNode>[], unknown>;
  onSelect: (id: string | number) => void;
  viewInExplorer: (id: string | number) => void;
  setFileInfo: (fileInfo: FileInfo | null) => void;
};

const BundlesGrid = ({
  files,
  onSelect,
  viewInExplorer,
  setFileInfo,
}: Props) => {
  const [entries, setEntries] = useState<TreeNodeInfo<FileTreeNode>[]>([]);
  useEffect(() => {
    if (!files?.data) {
      return;
    }
    const elements: TreeNodeInfo<FileTreeNode>[] = [];
    forEachNode(files.data, (node) => {
      const fileNode = node.nodeData as FileTreeNode;
      if (fileNode.isDirectory && fileNode.bundlePath) {
        elements.push(node);
      }
    });
    setEntries(elements);
  }, [files]);

  return (
    <div className="bundles-grid y-scroll">
      {entries.map((e) => (
        <Bundle
          setFileInfo={setFileInfo}
          onSelect={onSelect}
          viewInExplorer={viewInExplorer}
          info={e}
          node={e.nodeData ?? ({} as FileTreeNode)}
          key={e.nodeData?.path}
        />
      ))}
    </div>
  );
};

export default BundlesGrid;
