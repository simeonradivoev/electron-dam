import { Divider, TreeNodeInfo } from '@blueprintjs/core';
import { UseQueryResult } from '@tanstack/react-query';
import { FileType } from 'shared/constants';
import ExplorerBarSearch from './ExplorerBarSearch';
import ExplorerBarTree from './ExplorerBarTree';

interface ExplorerBarProps {
  files: UseQueryResult<TreeNodeInfo<FileTreeNode>[], unknown>;
  setSelected: (id: string | number, selected: boolean) => void;
  setExpanded: (nodePath: NodePath, expanded: boolean) => void;
  tags: UseQueryResult<string[], unknown>;
  typeFilter: FileType[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  toggleType: (type: FileType) => void;
  filter: string | undefined;
  setFilter: (filter: string | undefined) => void;
}

const ExplorerBar = ({
  setSelected,
  setExpanded,
  tags,
  typeFilter,
  files,
  selectedTags,
  toggleTag,
  toggleType,
  filter,
  setFilter,
}: ExplorerBarProps) => {
  return (
    <div className="side-panel">
      <ExplorerBarSearch
        tags={tags}
        filter={filter}
        setFilter={setFilter}
        typeFilter={typeFilter}
        toggleType={toggleType}
        selectedTags={selectedTags}
        toggleTag={toggleTag}
        files={files}
      />
      <Divider />
      <ExplorerBarTree
        filter={filter}
        files={files}
        setSelected={setSelected}
        setExpanded={setExpanded}
      />
    </div>
  );
};

export default ExplorerBar;
