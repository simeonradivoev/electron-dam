import {
  Button,
  InputGroup,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  ResizeSensor,
  Spinner,
} from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Key, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';
import Bundle from './Bundle';

function BundlesGrid() {
  const { setFileInfo, projectDirectory } = useApp();
  const [filter, setFilter] = useState('');
  const [selectedBundles, setSelectedBundles] = useState<string[]>([]);
  const parentRef = useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = useState<number | undefined>(undefined);

  const {
    data: bundles,
    refetch: refetchBundles,
    isFetched: isFetchingBundles,
  } = useQuery<BundleInfo[], undefined, BundleInfo[]>({
    enabled: !!projectDirectory,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    queryKey: ['bundles', projectDirectory],
    queryFn: () => {
      return window.api.getBundles();
    },
  });
  const navigate = useNavigate();

  const handleSelect = (id: string | number, e?: React.MouseEvent) => {
    if (e?.ctrlKey || e?.metaKey) {
      setSelectedBundles((prev) => {
        if (prev.includes(id.toString())) {
          return prev.filter((i) => i !== id.toString());
        }
        return [...prev, id.toString()];
      });
    } else if (e?.shiftKey) {
      // Simple shift select implementation (range selection could be added later if needed)
      setSelectedBundles((prev) => {
        if (!prev.includes(id.toString())) {
          return [...prev, id.toString()];
        }
        return prev;
      });
    } else {
      navigate({
        pathname: `/bundles/${encodeURIComponent(id.toString())}/info`,
      });
    }
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
    <ResizeSensor onResize={(e) => setParentWidth(e[0].contentRect.width)}>
      <div className="bundles-grid">
        <Navbar>
          <NavbarGroup align="left">
            <Button onClick={handleNew} title="Create New Virtual Bundle" minimal icon="add" />
            {selectedBundles.length > 0 && (
              <Button
                onClick={handleMassDelete}
                title={`Delete ${selectedBundles.length} items`}
                minimal
                icon="trash"
                intent="danger"
              />
            )}
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
            <Button disabled={isFetchingBundles} onClick={handleRefresh} minimal icon="refresh" />
            <NavbarDivider />
            <Button minimal icon="menu" rightIcon="caret-down" />
          </NavbarGroup>
        </Navbar>
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
                            setFileInfo={setFileInfo}
                            onSelect={handleSelect}
                            bundle={bundles[index]}
                            handleRefresh={handleRefresh}
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
      </div>
    </ResizeSensor>
  );
}

export default BundlesGrid;
