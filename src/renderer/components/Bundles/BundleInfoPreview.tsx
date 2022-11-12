import {
  Classes,
  Divider,
  Spinner,
  Tag,
  TreeNodeInfo,
} from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import React, { useContext } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';
import { flattenNodes } from 'renderer/scripts/file-tree';
import humanFileSize from 'renderer/scripts/utils';
import BundleFileEntry from './BundleFileEntry';
import { BundleInfoContextType } from './BundleInfo';
import BundlePreview from './BundlePreview';

const BundleInfoPreview = () => {
  const { fileInfo } = useOutletContext<BundleInfoContextType>();
  const { files } = useContext(AppContext);

  const flatNodes = useQuery<TreeNodeInfo<FileTreeNode>[]>(
    ['flag-nodes', fileInfo.data],
    () => {
      return flattenNodes(files.data)
        .filter((node) => !node.nodeData?.isDirectory)
        .filter((node) => node.nodeData?.path.startsWith(fileInfo.data!.path));
    },
    { enabled: !!fileInfo.data }
  );

  return (
    <>
      <BundlePreview fileInfo={fileInfo.data ?? null} />
      {flatNodes.data ? (
        <>
          <ul className="file-stats">
            {flatNodes.data ? (
              <Tag icon="floppy-disk" minimal>
                Size:{' '}
                {humanFileSize(
                  flatNodes.data.length > 0
                    ? flatNodes.data
                        .map((node) => node.nodeData?.size ?? 0)
                        .reduce((sizeTotal, size) => sizeTotal + size)
                    : 0
                )}
              </Tag>
            ) : (
              <Tag icon="floppy-disk" minimal>
                <div className={Classes.SKELETON}>Size: Loading</div>
              </Tag>
            )}
          </ul>
          <Divider />
          <div className="asset-grid">
            {flatNodes.data.map((node) => (
              <BundleFileEntry node={node} key={node.id} />
            ))}
          </div>
        </>
      ) : (
        <>
          <Spinner />
        </>
      )}
    </>
  );
};

export default BundleInfoPreview;
