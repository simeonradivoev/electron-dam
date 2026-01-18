import {
  InputGroup,
  NonIdealState,
  Spinner,
  TreeNodeInfo,
  Button,
  Menu,
  ProgressBar,
  Tag,
  ButtonGroup,
  Divider,
  NavbarGroup,
  IconSize,
  MenuItem,
  Popover,
} from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import cn from 'classnames';
import log from 'electron-log/renderer';
import { normalize } from 'pathe';
import React, { useEffect, useRef, useCallback, useMemo, useState } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import Split from 'react-split';
import { useTasks } from 'renderer/contexts/TasksContext';
import { FileTypeIcons, toggleElementMutable } from 'renderer/scripts/utils';
import scrollIntoView from 'scroll-into-view-if-needed';
import { FileType } from 'shared/constants';
import { useLocalStorage, useSessionStorage } from 'usehooks-ts';
import '../../App.scss';
import { useApp } from '../../contexts/AppContext';
import FileInfoPanel from '../FileInfoPanel/FileInfoPanel';
import SearchResultEntry from './SearchResultEntry';

const SEARCH_QUERY_KEY = 'search-page-query';

type PaginationItem = number | 'ellipsis';

export function getPaginationRange(current: number, total: number, siblings = 1): PaginationItem[] {
  const range: PaginationItem[] = [];

  const start = Math.max(2, current - siblings);
  const end = Math.min(total - 1, current + siblings);

  // First page
  range.push(1);

  // Left ellipsis
  if (start > 2) {
    range.push('ellipsis');
  }

  // Middle pages
  for (let i = start; i <= end; i += 1) {
    range.push(i);
  }

  // Right ellipsis
  if (end < total - 1) {
    range.push('ellipsis');
  }

  // Last page
  if (total > 1) {
    range.push(total);
  }

  return range;
}

async function fetchSearchResults(
  query: string,
  typeFilter: FileType[],
  page: number,
): Promise<{
  nodes: TreeNodeInfo<SearchEntryResult>[];
  count: number | undefined;
  pageSize: number | undefined;
}> {
  if (!query) {
    return { nodes: [], count: undefined, pageSize: undefined };
  }

  try {
    const searchResults = await window.api.search(query, typeFilter, page);
    if (searchResults) {
      // Convert FileTreeNode results to TreeNodeInfo format for BundleFileEntry
      const treeNodes: TreeNodeInfo<SearchEntryResult>[] = searchResults.nodes
        .map((n) => {
          n.path = normalize(n.path);
          return n;
        })
        .map(
          (node) =>
            ({
              id: node.path,
              label: node.filename,
              nodeData: node,
              icon: node.fileType ? FileTypeIcons[node.fileType] : 'document',
            }) satisfies TreeNodeInfo<SearchEntryResult>,
        );
      return { nodes: treeNodes, count: searchResults.count, pageSize: searchResults.pageSize };
    }
    return { nodes: [], count: undefined, pageSize: undefined };
  } catch (error) {
    log.error('Search failed:', error);
    return { nodes: [], count: undefined, pageSize: undefined };
  }
}

function SearchPage() {
  const { database, inspectBundle, viewInExplorer, projectDirectory } = useApp();
  const searchMatch = useMatch('/search/:query/:page');
  const search = searchMatch?.params.query;
  const page = searchMatch?.params.page ? Number.parseInt(searchMatch.params.page, 10) : 0;
  const [query, setQuery] = useLocalStorage<string | undefined>(SEARCH_QUERY_KEY, () => search);
  const [typeFilter, setTypeFilter] = useLocalStorage<FileType[]>('searchTypeFilter', []);
  const selectedRef = useRef<HTMLLIElement | null>(null);
  const navigate = useNavigate();
  const [selected, setSelected] = useSessionStorage<string[]>('selected', []);
  const [showFileView, setShowFileView] = useLocalStorage('showSearchFileView', false);
  const [sideBarSize, setSideBarSize] = useState(38);
  const { tasks, isPending: isPendingTasks } = useTasks();

  const toggleType = useCallback(
    (type: FileType) => {
      setTypeFilter(toggleElementMutable(typeFilter, type));
      navigate({ pathname: `/search/${search}/${0}` });
    },
    [navigate, search, setTypeFilter, typeFilter],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const { value } = e.target as never;
        navigate({ pathname: `/search/${value}/0` });
      }
    },
    [navigate],
  );

  const handleSetPage = useCallback(
    (p: number) => {
      navigate({ pathname: `/search/${searchMatch?.params.query}/${p}` });
    },
    [navigate, searchMatch?.params.query],
  );

  const reIndex = useCallback(() => {
    window.api.reIndexFiles();
  }, []);

  useEffect(() => {
    if (selectedRef.current) {
      scrollIntoView(selectedRef.current, {
        block: 'nearest',
        inline: 'nearest',
        scrollMode: 'if-needed',
      });
    }
  }, [database, selectedRef]);

  const indexingFiles = tasks.some(
    (t) =>
      (t.status === 'RUNNING' || t.status === 'PENDING') && t.label.startsWith('Indexing Assets'),
  );
  const searchQuery = useQuery({
    queryKey: [SEARCH_QUERY_KEY, projectDirectory, search, typeFilter, page],
    queryFn: ({ queryKey }) =>
      fetchSearchResults(queryKey[2] as string, queryKey[3] as FileType[], queryKey[4] as number),
    enabled: !indexingFiles && !isPendingTasks,
  });

  const pageCount = useMemo(() => {
    if (searchQuery.data?.count && searchQuery.data?.pageSize) {
      return Math.ceil(searchQuery.data.count / searchQuery.data.pageSize);
    }
    return 0;
  }, [searchQuery.data?.count, searchQuery.data?.pageSize]);

  const contextMenu = (node: TreeNodeInfo<SearchEntryResult>): JSX.Element => {
    return (
      <Menu>
        <MenuItem
          icon="folder-open"
          disabled={!node.nodeData}
          text="View In Explorer"
          onClick={() => {
            viewInExplorer(node.nodeData?.path ?? '');
          }}
        />
        {node.nodeData && node.nodeData?.fileType === FileType.Bundle && (
          <MenuItem
            icon="projects"
            text="Inspect Bundle"
            onClick={() => {
              inspectBundle(node.nodeData!.path);
            }}
          />
        )}
      </Menu>
    );
  };

  const searchResults = (
    <div className="search-results-list y-scroll">
      <ul>
        {searchQuery.data?.nodes.map((node) => (
          <SearchResultEntry
            key={node.id}
            contextMenu={contextMenu}
            searchTerm={search}
            onClick={() => {
              if (node.nodeData?.path) {
                setSelected([node.nodeData.path]);
              }
            }}
            onDoubleClick={() => {
              if (node.nodeData?.path) {
                viewInExplorer(node.nodeData?.path);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                if (node.nodeData?.path) {
                  setSelected([node.nodeData.path]);
                }
              }
            }}
            ref={
              selected && node.nodeData && selected.includes(node.nodeData.path)
                ? selectedRef
                : undefined
            }
            node={node}
            isSelected={selected && node.nodeData ? selected.includes(node.nodeData?.path) : false}
          />
        ))}
      </ul>
      <ButtonGroup variant="minimal" className="pages">
        {getPaginationRange(page, pageCount - 1, 10).map((p) =>
          p === 'ellipsis' ? (
            <Button>...</Button>
          ) : (
            <Button className={cn({ active: p === page + 1 })} onClick={() => handleSetPage(p - 1)}>
              {p}
            </Button>
          ),
        )}
      </ButtonGroup>
    </div>
  );

  let searchSection: JSX.Element | undefined;
  if (indexingFiles || isPendingTasks) {
    searchSection = (
      <div className="search-empty">
        <NonIdealState icon={<Spinner />} title="Indexing Files..." />
      </div>
    );
  } else if (searchQuery.isLoading) {
    searchSection = (
      <div className="search-loading-state">
        <div className="search-loading-content">
          <Spinner size={40} />
          <div className="search-loading-text">
            <p>Searching for &quot;{search}&quot;...</p>
            <p className="search-status">Please wait</p>
          </div>
        </div>
        <ProgressBar intent="primary" />
      </div>
    );
  } else if (
    searchQuery.isEnabled &&
    (!searchQuery.data || searchQuery.data.nodes.length === 0) &&
    search
  ) {
    searchSection = (
      <div className="search-empty">
        <NonIdealState
          icon="search"
          title="No results found"
          description={`No files matched "${search}"`}
        />
      </div>
    );
  } else if (searchQuery.isEnabled && !search) {
    searchSection = (
      <div className="search-empty">
        <NonIdealState
          icon="search"
          title="Search for files"
          description="Press Enter to search or type to update your query"
        />
      </div>
    );
  } else if (searchQuery.isEnabled && searchQuery.data && searchQuery.data.nodes.length > 0) {
    if (showFileView) {
      searchSection = (
        <Split
          direction="horizontal"
          cursor="col-resize"
          className="search-results-split"
          snapOffset={30}
          minSize={100}
          expandToMin={false}
          gutterSize={5}
          sizes={[sideBarSize, 100 - sideBarSize]}
          onDragEnd={(size) => {
            setSideBarSize(size[0]);
          }}
        >
          {searchResults}
          <div className="search-explorer">
            {!!selected && selected.length > 0 && showFileView ? (
              <FileInfoPanel
                allowTagEditing={false}
                searchQuery={search}
                showSource
                item={selected[0]}
              />
            ) : (
              <NonIdealState icon="eye-open">Select asset to view</NonIdealState>
            )}
          </div>
        </Split>
      );
    } else {
      searchSection = searchResults;
    }
  }

  return (
    <div className="search-page">
      <div className="search-input-container">
        <InputGroup
          disabled={!searchQuery.isEnabled}
          type="search"
          size="large"
          maxLength={512}
          leftIcon="search"
          placeholder="Search files..."
          value={query ?? ''}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          rightElement={
            searchQuery.isEnabled ? (
              <Popover
                minimal
                content={
                  <Menu>
                    <MenuItem icon="refresh" text="Re-Index Assets" onClick={reIndex} />
                  </Menu>
                }
                placement="bottom"
              >
                <Button variant="minimal" icon="settings" />
              </Popover>
            ) : (
              <Spinner size={IconSize.STANDARD} />
            )
          }
        />
      </div>

      <div className="search-results-container">
        <div className="search-results-header">
          <NavbarGroup className="results-count">
            Page {page + 1} out of {pageCount} <Divider /> <Tag>{searchQuery.data?.count}</Tag>{' '}
            result
            {searchQuery.data?.count !== 1 ? 's' : ''}
          </NavbarGroup>
          <NavbarGroup>
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
            <NavbarGroup>
              <Button
                active={showFileView}
                variant="minimal"
                onClick={() => setShowFileView(!showFileView)}
                endIcon="comparison"
              >
                Explorer View
              </Button>
            </NavbarGroup>
          </NavbarGroup>
        </div>
        {searchSection}
      </div>
    </div>
  );
}

export default SearchPage;
