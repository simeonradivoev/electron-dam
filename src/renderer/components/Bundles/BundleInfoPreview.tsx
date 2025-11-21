import {
  Classes,
  Divider,
  Spinner,
  Tag,
  TreeNodeInfo,
} from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import React, { useContext, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';
import { flattenNodes } from 'renderer/scripts/file-tree';
import humanFileSize from 'renderer/scripts/utils';
import BundleFileEntry from './BundleFileEntry';
import { BundleDetailsContextType } from './BundleDetailsLayout';
import BundlePreview from './BundlePreview';
import FolderFileGrid from '../FileInfoPanel/FolderFileGrid';

/**
 * This is the bundle preview that is shown in the bundles tab not in the explorer
 */
const BundleInfoPreview = () => {
  const { bundle, viewInExplorer } =
    useOutletContext<BundleDetailsContextType>();
  const { files } = useContext(AppContext);

  const flatNodes = useQuery<TreeNodeInfo<FileTreeNode>[]>(
    ['flat-nodes', bundle.data?.id],
    ({ queryKey }) => {
      return flattenNodes(files.data)
        .filter((node) => !node.nodeData?.isDirectory)
        .filter((node) =>
          node.nodeData?.path.startsWith(queryKey[1] as string)
        );
    },
    { enabled: !!bundle.data?.id }
  );

  const handleView = useCallback(() => {
    viewInExplorer(bundle.data!.id);
  }, [bundle, viewInExplorer]);

  return (
    <>
      <BundlePreview
        bundle={bundle.data ?? null}
        onSelect={() => handleView()}
      />
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
            {bundle.data?.isVirtual && (
              <Tag icon="cloud" minimal title={bundle.data?.id}>
                Virtual
              </Tag>
            )}
          </ul>
          <Divider />
          <FolderFileGrid path={bundle.data?.id ?? ''} />
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
