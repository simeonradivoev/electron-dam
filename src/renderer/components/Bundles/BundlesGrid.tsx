import {
  Button,
  ContextMenu,
  Divider,
  InputGroup,
  Menu,
  MenuItem,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  Popover,
  ResizeSensor,
  Spinner,
  SpinnerSize,
} from '@blueprintjs/core';
import { keepPreviousData, useIsMutating, useMutation, useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { normalize } from 'pathe';
import { Key, useMemo, useRef, useState } from 'react';
import { SiHumblebundle, SiItchdotio } from 'react-icons/si';
import { useNavigate } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';
import { QueryKeys } from 'renderer/scripts/utils';
import { LoginProvider } from 'shared/constants';
import Bundle from './Bundle';

function BundlesGrid() {
  const { projectDirectory } = useApp();
  const [filter, setFilter] = useState('');
  const [selectedBundles, setSelectedBundles] = useState<string[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = useState<number | undefined>(undefined);
  const isImporting = useIsMutating({ mutationKey: ['import'] }) > 0;
  const importMutation = useMutation({
    mutationKey: ['import'],
    mutationFn: (provider: LoginProvider) => window.api.importBundles(provider),
    onSuccess: (data, vars, result, context) => {
      context.client.invalidateQueries({ queryKey: [QueryKeys.bundles, projectDirectory] });
    },
  });

  const {
    data: bundles,
    refetch: refetchBundles,
    isFetching: isFetchingBundles,
  } = useQuery<BundleInfo[], undefined, BundleInfo[]>({
    enabled: !!projectDirectory,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
    queryKey: [QueryKeys.bundles, projectDirectory],
    queryFn: () => {
      return window.api.getBundles();
    },
  });
  const navigate = useNavigate();
  const lastSelectedRef = useRef<string | null>(null);

  const handleSelect = (id: string | number, e?: React.MouseEvent) => {
    if (!bundles) return;

    const idStr = id.toString();

    if (e?.shiftKey && lastSelectedRef.current) {
      setSelectedBundles((prev) => {
        const start = bundles.findIndex((b) => b.id === lastSelectedRef.current!);
        const end = bundles?.findIndex((b) => b.id === idStr);

        if (start === -1 || end === -1) {
          return prev;
        }

        const [from, to] = start < end ? [start, end] : [end, start];
        const range = bundles.slice(from, to + 1);

        // Typical UX: replace selection
        return range.map((b) => b.id.toString());
      });
    } else if (e?.ctrlKey || e?.metaKey) {
      setSelectedBundles((prev) =>
        prev.includes(idStr) ? prev.filter((i) => i !== idStr) : [...prev, idStr],
      );
    } else {
      // Normal click = single select + navigate
      setSelectedBundles([idStr]);
      navigate({
        pathname: `/bundles/info/${encodeURIComponent(normalize(idStr))}`,
      });
    }

    lastSelectedRef.current = idStr;
  };

  const handleMassDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedBundles.length} bundles?`)) {
      return;
    }

    await Promise.all(selectedBundles.map((id) => window.api.deleteBundle(id)));
    setSelectedBundles([]);
    refetchBundles();
  };

  const handleNew = () => {
    navigate({
      pathname: `/bundles/new`,
    });
  };

  const handleRefresh = () => {
    refetchBundles();
  };

  function handleSearchSubmit(e: any) {
    e.preventDefault();
    setFilter(e.target.value);
  }

  const { size, gap, columns, count } = useMemo((): {
    size: { width: number; height: number };
    gap: number;
    columns: number;
    count: number;
  } => {
    const emScale = Number(
      window.getComputedStyle(document.body).getPropertyValue('font-size').match(/\d+/)?.[0],
    );
    const width = 12.3 * emScale;
    const height = 10 * emScale;
    const g = 0.5 * emScale;
    const c = parentWidth ? Math.ceil(Math.max(1, parentWidth / (width + g))) + 1 : 1;
    return {
      size: { width, height },
      gap: g,
      columns: c,
      count: bundles?.length && parentWidth ? Math.ceil(bundles.length / c) : 0,
    };
  }, [bundles?.length, parentWidth]);

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => size.height,
    gap,
  });

  return (
    <div className="bundles-grid">
      <Navbar>
        <NavbarGroup align="left">
          <Button onClick={handleNew} title="Create New Virtual Bundle" minimal icon="add" />
          {selectedBundles.length > 0 && (
            <Button
              onClick={handleMassDelete}
              title={`Delete ${selectedBundles.length} items`}
              variant="minimal"
              icon="trash"
              intent="danger"
            />
          )}
          <NavbarDivider />
          <Popover
            minimal
            position="bottom-left"
            content={
              <Menu>
                <MenuItem
                  icon={<SiHumblebundle />}
                  text="Humble Bundles"
                  onClick={() => importMutation.mutate(LoginProvider.Humble)}
                />
                <MenuItem
                  icon={<SiItchdotio />}
                  text="Itch.io"
                  onClick={() => importMutation.mutate(LoginProvider.Humble)}
                />
              </Menu>
            }
          >
            <Button
              variant="minimal"
              disabled={isImporting}
              icon="import"
              endIcon={isImporting ? <Spinner size={SpinnerSize.SMALL} /> : 'caret-down'}
            >
              Import
            </Button>
          </Popover>
        </NavbarGroup>
        <NavbarGroup align="right">
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
            disabled={isFetchingBundles}
            onClick={handleRefresh}
            variant="minimal"
            icon="refresh"
          />
          <NavbarDivider />
          <Button variant="minimal" icon="menu" rightIcon="caret-down" />
        </NavbarGroup>
      </Navbar>
      <ResizeSensor targetRef={parentRef} onResize={(e) => setParentWidth(e[0].contentRect.width)}>
        <div
          ref={parentRef}
          style={{
            overflow: 'auto', // Make it scroll!
          }}
          className="grid y-scroll wide"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedBundles([]);
            }
          }}
          role="button"
          tabIndex={0}
          onKeyDown={() => {}}
        >
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {bundles &&
              rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowElements: (JSX.Element | undefined)[] = [];
                for (let i = 0; i < columns; i += 1) {
                  const index = i + virtualRow.index * columns;
                  if (index < bundles.length) {
                    rowElements.push(
                      bundles[index] && (
                        <div
                          key={index}
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          style={{ display: 'contents' }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={() => {}}
                        >
                          <Bundle
                            onSelect={handleSelect}
                            bundle={bundles[index]}
                            allowDelete
                            isSelected={selectedBundles.includes(bundles[index].id.toString())}
                          />
                        </div>
                      ),
                    );
                  }
                }
                return (
                  <div
                    className="row"
                    data-index={virtualRow.index}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    ref={rowVirtualizer.measureElement}
                    key={virtualRow.key as Key}
                  >
                    {rowElements}
                  </div>
                );
              })}
          </div>
        </div>
      </ResizeSensor>
    </div>
  );
}

export default BundlesGrid;
