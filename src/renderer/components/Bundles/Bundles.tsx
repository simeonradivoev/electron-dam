import { TreeNodeInfo } from '@blueprintjs/core';
import { UseQueryResult } from '@tanstack/react-query';
import { IDBPDatabase } from 'idb';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BundleInfo from './BundleInfo';
import BundlesGrid from './BundlesGrid';

type Props = {
  database: IDBPDatabase<FilesDB> | undefined;
  nodes: UseQueryResult<TreeNodeInfo<FileTreeNode>[], unknown>;
  fileInfo: FileInfo | null;
  setSelected: (id: string | number, selected: boolean) => void;
  setFileInfo: (fileInfo: FileInfo | null) => void;
  filter: string | undefined;
};

const Bundles = ({
  setSelected,
  fileInfo,
  nodes,
  setFileInfo,
  database,
  filter,
}: Props) => {
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const navigate = useNavigate();

  return showInfo ? (
    <BundleInfo
      nodes={nodes}
      database={database}
      setFileInfo={setFileInfo}
      returnFunc={() => setShowInfo(false)}
      fileInfo={fileInfo}
      filter={filter}
    />
  ) : (
    <BundlesGrid
      setFileInfo={setFileInfo}
      onSelect={(id) => {
        setSelected(id, true);
        setShowInfo(true);
      }}
      viewInExplorer={(id) => {
        setSelected(id, true);
        navigate({ pathname: '/explorer', search: `?focus=${id}` });
      }}
      files={nodes}
    />
  );
};

export default Bundles;
