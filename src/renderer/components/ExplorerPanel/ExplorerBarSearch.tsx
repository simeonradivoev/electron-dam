import {
  ControlGroup,
  InputGroup,
  Divider,
  Button,
  Collapse,
  ButtonGroup,
  Tag,
  TreeNodeInfo,
  Navbar,
  NavbarDivider,
} from '@blueprintjs/core';
import { useQueryClient, UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { FileTypeIcons } from 'renderer/scripts/utils';
import { FileType } from 'shared/constants';

type Props = {
  tags: UseQueryResult<string[], unknown>;
  filter: string | undefined;
  setFilter: (filter: string | undefined) => void;
  typeFilter: FileType[];
  toggleType: (type: FileType) => void;
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  files: UseQueryResult<TreeNodeInfo<FileTreeNode>[], unknown>;
};

const ExplorerBarSearch = ({
  tags,
  filter,
  setFilter,
  typeFilter,
  toggleType,
  selectedTags,
  toggleTag,
  files,
}: Props) => {
  const queryClient = useQueryClient();

  const [filteringExpanded, setFilteringExpanded] = useState(
    (sessionStorage.getItem('filter-expanded') ?? 'false') === 'true'
  );

  const toggleExpanded = () => {
    sessionStorage.setItem('filter-expanded', (!filteringExpanded).toString());
    setFilteringExpanded(!filteringExpanded);
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries(['files']);
  };

  function handleSearchSubmit(e: any) {
    e.preventDefault();
    setFilter(e.target.value);
  }

  return (
    <Navbar>
      {' '}
      <ControlGroup fill>
        <InputGroup
          inputRef={(element) => {
            ((element ?? {}) as any).onsearch = handleSearchSubmit;
          }}
          name="search"
          fill
          className="search"
          leftIcon="search"
          placeholder="Search"
          type="search"
          defaultValue={filter}
        />

        <Button
          disabled={files.isFetching}
          onClick={handleRefresh}
          minimal
          icon="refresh"
        />
        <Divider />
        <Button
          onClick={toggleExpanded}
          minimal
          icon="menu"
          rightIcon={filteringExpanded ? 'caret-up' : 'caret-down'}
        />
      </ControlGroup>
      <Collapse isOpen={filteringExpanded}>
        {Object.values(FileType).map((type) => (
          <ButtonGroup minimal key={type}>
            <Button
              disabled={files.isFetching}
              icon={FileTypeIcons[type]}
              onClick={() => toggleType(type)}
              active={typeFilter.includes(type)}
              title={type}
            />
            <Divider />
          </ButtonGroup>
        ))}
        <Divider />
        <div className="quick-tags x-scroll">
          {tags.isSuccess ? (
            tags.data.map((tag) => (
              <Tag
                className="tag"
                key={tag}
                interactive={!files.isFetching}
                title={tag}
                minimal={selectedTags.indexOf(tag) < 0}
                onClick={() => toggleTag(tag)}
              >
                {tag}
                <Tag className="amount" round>
                  {10}
                </Tag>
              </Tag>
            ))
          ) : (
            <></>
          )}
        </div>
      </Collapse>
    </Navbar>
  );
};

export default ExplorerBarSearch;
