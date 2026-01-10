import {
  ControlGroup,
  InputGroup,
  Divider,
  Button,
  Collapse,
  ButtonGroup,
  Navbar,
} from '@blueprintjs/core';
import { TreeInstance } from '@headless-tree/core';
import cn from 'classnames';
import { useState } from 'react';
import { useApp } from 'renderer/contexts/AppContext';
import { FileTypeIcons } from 'renderer/scripts/utils';
import { FileType } from 'shared/constants';

type Props = {
  tree: TreeInstance<FileTreeNode>;
  refresh: () => void;
};

function ExplorerBarSearch({ tree, refresh }: Props) {
  const { toggleType, filter, setFilter, typeFilter } = useApp();

  const [filteringExpanded, setFilteringExpanded] = useState(
    (localStorage.getItem('filter-expanded') ?? 'false') === 'true',
  );

  const toggleExpanded = () => {
    localStorage.setItem('filter-expanded', (!filteringExpanded).toString());
    setFilteringExpanded(!filteringExpanded);
  };

  return (
    <Navbar>
      {' '}
      <ControlGroup fill>
        <InputGroup
          inputRef={(e: HTMLInputElement) => {
            tree.registerSearchInputElement(e);
          }}
          value={filter ?? ''}
          onChange={(e: any) => setFilter(e.target.value)}
          name="search"
          fill
          className="search"
          leftIcon="search"
          placeholder="Search"
          type="search"
        />

        <Button onClick={refresh} variant="minimal" icon="refresh" />
        <Divider />
        <Button
          onClick={toggleExpanded}
          variant="minimal"
          icon="menu"
          className={cn({ 'has-badge-dot': typeFilter.length > 0 && !filteringExpanded })}
          endIcon={filteringExpanded ? 'caret-up' : 'caret-down'}
        />
      </ControlGroup>
      <Collapse isOpen={filteringExpanded}>
        {Object.values(FileType).map((type) => (
          <ButtonGroup variant="minimal" key={type}>
            <Button
              icon={FileTypeIcons[type]}
              onClick={() => toggleType(type)}
              active={typeFilter?.includes(type)}
              title={type}
            />
            <Divider />
          </ButtonGroup>
        ))}
      </Collapse>
    </Navbar>
  );
}

export default ExplorerBarSearch;
