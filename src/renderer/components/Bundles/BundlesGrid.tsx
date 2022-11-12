import { TreeNodeInfo } from '@blueprintjs/core';

import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';
import { forEachNode } from 'renderer/scripts/file-tree';
import Bundle from './Bundle';

const BundlesGrid = () => {
  const { files, setFileInfo, setSelected } = useContext(AppContext);
  const [entries, setEntries] = useState<TreeNodeInfo<FileTreeNode>[]>([]);
  const navigate = useNavigate();

  const viewInExplorer = (id: string | number) => {
    setSelected(id, true);
    navigate({
      pathname: '/explorer',
      search: `?focus=${id}`,
    });
  };

  const handleSelect = (id: string | number) => {
    setSelected(id, true);
    navigate({
      pathname: `/bundles/${id}/info`,
    });
  };

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
          onSelect={handleSelect}
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
