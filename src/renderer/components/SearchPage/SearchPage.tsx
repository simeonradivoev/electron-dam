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
} from '@blueprintjs/core';
import { MenuItem2, Popover2 } from '@blueprintjs/popover2';
import { useMutation, useQuery } from '@tanstack/react-query';
import cn from 'classnames';
import { normalize } from 'pathe';
import React, { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { FileTypeIcons, toggleElementMutable } from 'renderer/scripts/utils';
import scrollIntoView from 'scroll-into-view-if-needed';
import { FileType } from 'shared/constants';
import { useLocalStorage, useSessionStorage } from 'usehooks-ts';
import '../../App.scss';
import { useApp } from '../../contexts/AppContext';
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
  for (let i = start; i <= end; i++) {
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
  nodes: TreeNodeInfo<SearchTreeNode>[];
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
      const treeNodes: TreeNodeInfo<SearchTreeNode>[] = searchResults.nodes
        .map((n) => {
          n.path = normalize(n.path);
          return n;
        })
        .map(
          (node) =>
            ({
              id: node.path,
              label: node.name,
              nodeData: node,
              icon: node.fileType ? FileTypeIcons[node.fileType] : 'document',
            }) satisfies TreeNodeInfo<SearchTreeNode>,
        );
      return { nodes: treeNodes, count: searchResults.count, pageSize: searchResults.pageSize };
    }
    return { nodes: [], count: undefined, pageSize: undefined };
  } catch (error) {
    console.error('Search failed:', error);
    return { nodes: [], count: undefined, pageSize: undefined };
  }
}

function SearchPage() {
  const { database, inspectBundle, viewInExplorer, projectDirectory } = useApp();
  const searchMatch = useMatch('/search/:query/:page');
  const search = searchMatch?.params.query;
  const page = searchMatch?.params.page ? Number.parseInt(searchMatch.params.page, 10) : 0;
  const [query, setQuery] = useLocalStorage<string | undefined>(SEARCH_QUERY_KEY, undefined);
  const [typeFilter, setTypeFilter] = useLocalStorage<FileType[]>('searchTypeFilter', []);
  const selectedRef = useRef<HTMLLIElement | null>(null);
  const navigate = useNavigate();
  const [selected, setSelected] = useSessionStorage<string[]>('selected', []);

  const toggleType = useCallback(
    (type: FileType) => {
      setTypeFilter(toggleElementMutable(typeFilter, type));
      navigate({ pathname: `/search/${search}/${0}` });
    },
    [setTypeFilter, typeFilter],
  );

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const { value } = e.target as any;
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
    window.api.reIndexDatabaseSearch();
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

  const searchQuery = useQuery({
    queryKey: [SEARCH_QUERY_KEY, projectDirectory, search, typeFilter, page],
    queryFn: () => fetchSearchResults(search ?? '', typeFilter, page),
    refetchOnWindowFocus: false,
    enabled: !!search,
  });

  const pageCount = useMemo(() => {
    if (searchQuery.data?.count && searchQuery.data?.pageSize) {
      return Math.ceil(searchQuery.data.count / searchQuery.data.pageSize);
    }
    return 0;
  }, [searchQuery.data?.count, searchQuery.data?.pageSize]);

  const contextMenu = (node: TreeNodeInfo<SearchTreeNode>): JSX.Element => {
    return (
      <Menu>
        <MenuItem2
          icon="folder-open"
          disabled={!node.nodeData}
          text="View In Explorer"
          onClick={() => {
            viewInExplorer(node.nodeData?.path ?? '');
          }}
        />
        {node.nodeData && node.nodeData?.fileType === FileType.Bundle && (
          <MenuItem2
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

  return (
    <div className="search-page">
      <div className="search-input-container">
        <InputGroup
          large
          leftIcon="search"
          placeholder="Search files..."
          value={query ?? ''}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          rightElement={
            <Popover2
              minimal
              content={
                <Menu>
                  <MenuItem2 icon="refresh" text="Re-Index Assets" onClick={reIndex} />
                </Menu>
              }
              placement="bottom"
            >
              <Button minimal icon="settings" />
            </Popover2>
          }
        />
      </div>

      <div className="search-results-container">
        {searchQuery.isLoading && search && (
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
        )}
        <div className="search-results-header">
          <ButtonGroup className="results-count">
            Page {page + 1} out of {pageCount} <Divider /> <Tag>{searchQuery.data?.count}</Tag>{' '}
            result
            {searchQuery.data?.count !== 1 ? 's' : ''}
          </ButtonGroup>
          <ul>
            {Object.values(FileType).map((type) => (
              <ButtonGroup minimal key={type}>
                <Button
                  icon={FileTypeIcons[type]}
                  onClick={() => toggleType(type)}
                  active={typeFilter?.includes(type)}
                  title={type}
                />
                <Divider />
              </ButtonGroup>
            ))}
          </ul>
        </div>
        {!searchQuery.isLoading && searchQuery.data && searchQuery.data.nodes.length > 0 && (
          <div className="search-results-list y-scroll">
            <ul>
              {searchQuery.data.nodes.map((node) => (
                <SearchResultEntry
                  key={node.id}
                  contextMenu={contextMenu}
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
                  isSelected={
                    selected && node.nodeData ? selected.includes(node.nodeData?.path) : false
                  }
                />
              ))}
            </ul>
            <ButtonGroup minimal className="pages">
              {getPaginationRange(page, pageCount - 1, 10).map((p) =>
                p === 'ellipsis' ? (
                  <Button>...</Button>
                ) : (
                  <Button className={cn({ active: p === page })} onClick={(e) => handleSetPage(p)}>
                    {p}
                  </Button>
                ),
              )}
            </ButtonGroup>
          </div>
        )}
        {!searchQuery.isLoading &&
          (!searchQuery.data || searchQuery.data.nodes.length === 0) &&
          search && (
            <div className="search-empty">
              <NonIdealState
                icon="search"
                title="No results found"
                description={`No files matched "${search}"`}
              />
            </div>
          )}
        {!searchQuery.isLoading && !search && (
          <div className="search-empty">
            <NonIdealState
              icon="search"
              title="Search for files"
              description="Press Enter to search or type to update your query"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default SearchPage;
