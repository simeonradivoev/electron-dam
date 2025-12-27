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
import { normalize } from 'pathe';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ToggleFileType } from 'renderer/scripts/filters';
import {
  FileTypeIcons,
  toggleElementMutable,
  useSavedState,
  useSavedStateRaw,
} from 'renderer/scripts/utils';
import scrollIntoView from 'scroll-into-view-if-needed';
import { FileType } from 'shared/constants';
import '../../App.scss';
import { useApp } from '../../contexts/AppContext';
import SearchResultEntry from './SearchResultEntry';

const SEARCH_QUERY_KEY = 'search-page-query';

async function fetchSearchResults(
  query: string,
  typeFilter: FileType[],
  page: number,
): Promise<{ nodes: TreeNodeInfo<SearchTreeNode>[]; count: number | undefined }> {
  if (!query) {
    return { nodes: [], count: undefined };
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
      return { nodes: treeNodes, count: searchResults.count };
    }
    return { nodes: [], count: undefined };
  } catch (error) {
    console.error('Search failed:', error);
    return { nodes: [], count: undefined };
  }
}

function SearchPage() {
  const { database, inspectBundle, viewInExplorer, projectDirectory } = useApp();
  const [query, setQuery] = useSavedStateRaw(SEARCH_QUERY_KEY);
  const [submittedQuery, setSubmittedQuery] = useState(() => query);
  const [page, setPage] = useState(0);
  const [typeFilter, setTypeFilter] = useSavedState<FileType[]>('searchTypeFilter', []);
  const selectedRef = useRef<HTMLLIElement | null>(null);
  const { mutate: selectedMutation } = useMutation<string[], Error, string[]>({
    mutationKey: ['selected'],
  });

  const { data: selected } = useQuery<string[] | undefined, Error, string[]>({
    queryKey: ['selected'],
  });

  const toggleType = useCallback(
    (type: FileType) => {
      setTypeFilter(toggleElementMutable(typeFilter, type));
    },
    [setTypeFilter, typeFilter],
  );

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPage(0);
      setSubmittedQuery((e.target as any).value);
    }
  }, []);

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
    queryKey: [SEARCH_QUERY_KEY, projectDirectory, submittedQuery, typeFilter, page],
    queryFn: () => fetchSearchResults(submittedQuery ?? '', typeFilter, page),
    refetchOnWindowFocus: false,
    enabled: !!submittedQuery,
  });

  const pageCount = useMemo(() => {
    if (searchQuery.data?.count) {
      return Math.ceil(searchQuery.data.count / 20);
    }
    return 0;
  }, [searchQuery.data?.count]);

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
        {searchQuery.isLoading && submittedQuery && (
          <div className="search-loading-state">
            <div className="search-loading-content">
              <Spinner size={40} />
              <div className="search-loading-text">
                <p>Searching for &quot;{submittedQuery}&quot;...</p>
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
                      selectedMutation([node.nodeData.path]);
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
                        selectedMutation([node.nodeData.path]);
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
            <ButtonGroup className="pages">
              {Array.from({ length: pageCount }, (value, index) => index).map((p) => (
                <Button intent={p === page ? 'primary' : 'none'} onClick={(e) => setPage(p)}>
                  {p + 1}
                </Button>
              ))}
            </ButtonGroup>
          </div>
        )}
        {!searchQuery.isLoading &&
          (!searchQuery.data || searchQuery.data.nodes.length === 0) &&
          submittedQuery && (
            <div className="search-empty">
              <NonIdealState
                icon="search"
                title="No results found"
                description={`No files matched "${submittedQuery}"`}
              />
            </div>
          )}
        {!searchQuery.isLoading && !submittedQuery && (
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
