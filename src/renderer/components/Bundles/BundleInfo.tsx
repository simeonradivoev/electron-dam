import {
  Button,
  Classes,
  Divider,
  Icon,
  Spinner,
  Tab,
  Tabs,
  Tag,
  TreeNodeInfo,
} from '@blueprintjs/core';
import { BreadcrumbProps, Breadcrumbs2 } from '@blueprintjs/popover2';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { IDBPDatabase } from 'idb';
import { useEffect, useState } from 'react';
import { flattenNodes } from 'renderer/scripts/file-tree';
import humanFileSize from 'renderer/scripts/utils';
import FileInfoTags from '../FileInfoPanel/FileInfoTags';
import BundleEditor from './BundleEditor';
import BundleFileEntry from './BundleFileEntry';
import BundlePreview from './BundlePreview';

type Props = {
  database: IDBPDatabase<FilesDB> | undefined;
  fileInfo: FileInfo | null;
  setFileInfo: (fileInfo: FileInfo | null) => void;
  returnFunc: () => void;
  filter: string | undefined;
  nodes: UseQueryResult<TreeNodeInfo<FileTreeNode>[], unknown>;
};

const BundleInfo = ({
  fileInfo,
  setFileInfo,
  returnFunc,
  database,
  filter,
  nodes,
}: Props) => {
  const BREADCRUMBS: BreadcrumbProps[] = [
    { onClick: returnFunc, icon: 'projects', text: 'Bundles' },
    { icon: 'box', text: fileInfo ? fileInfo.name : <Spinner size={12} /> },
  ];

  const flatNodes = useQuery<TreeNodeInfo<FileTreeNode>[]>(
    ['flag-nodes', fileInfo],
    () => {
      return flattenNodes(nodes.data)
        .filter((node) => !node.nodeData?.isDirectory)
        .filter((node) => node.nodeData?.path.startsWith(fileInfo!.path));
    },
    { enabled: !!fileInfo }
  );

  return (
    <div className="bundle-info">
      <Breadcrumbs2 className="breadcrumbs" items={BREADCRUMBS} />
      <Divider />
      <Tabs renderActiveTabPanelOnly id="bundle-info" className="y-scroll">
        <Tab
          className="bundle-info-tab"
          id="info-tab"
          title="Info"
          panel={
            <>
              <BundlePreview fileInfo={fileInfo} />
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
          }
        />
        <Tab
          id="edit-tab"
          title="Edit"
          disabled={!fileInfo}
          panel={
            fileInfo ? (
              <BundleEditor
                database={database}
                setFileInfo={setFileInfo}
                fileInfo={fileInfo}
              />
            ) : (
              <></>
            )
          }
        />
      </Tabs>
    </div>
  );
};

export default BundleInfo;
