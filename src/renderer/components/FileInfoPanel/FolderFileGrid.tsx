import { NonIdealState, Spinner, TreeNodeInfo } from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import React, { useContext } from 'react';
import { AppContext } from 'renderer/AppContext';
import { flattenNodes } from 'renderer/scripts/file-tree';
import BundleFileEntry from '../Bundles/BundleFileEntry';

type Props = {
  path: string;
};

const FolderFileGrid = ({ path }: Props) => {
  const { files } = useContext(AppContext);

  const flatNodes = useQuery<TreeNodeInfo<FileTreeNode>[]>(
    ['flat-nodes', path],
    ({ queryKey }) => {
      return flattenNodes(files.data)
        .filter((node) => !node.nodeData?.isDirectory)
        .filter((node) =>
          node.nodeData?.path.startsWith(queryKey[1] as string)
        );
    }
  );

  return (
    <>
      {flatNodes.data ? (
        <div className="asset-grid">
          {flatNodes.data.map((node) => (
            <BundleFileEntry node={node} key={node.id} />
          ))}
        </div>
      ) : (
        <NonIdealState
          icon={<Spinner />}
          title="Loading..."
          description="Please wait while we load a bundles..."
        />
      )}
    </>
  );
};

export default FolderFileGrid;
