import { NonIdealState, ResizeSensor, Spinner } from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { Key, useLayoutEffect, useMemo, useRef, useState } from 'react';
import BundleFileEntry from '../Bundles/BundleFileEntry';

type Props = {
  path: string;
  className?: string;
};

function FolderFileGrid({ path, className }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = useState<number | undefined>(undefined);

  const { data: files } = useQuery({
    enabled: !!path,
    queryKey: ['grid-files', path],
    queryFn: () => window.api.getAllFiles(path),
    refetchOnWindowFocus: false,
  });

  const { size, gap, columns, count } = useMemo((): {
    size: number;
    gap: number;
    columns: number;
    count: number;
  } => {
    const emScale = Number(
      window.getComputedStyle(document.body).getPropertyValue('font-size').match(/\d+/)?.[0],
    );
    const s = 8 * emScale;
    const g = 0.5 * emScale;
    const c = parentWidth ? Math.round(Math.max(1, parentWidth / (s + g))) : 1;
    return {
      size: s,
      gap: g,
      columns: c,
      count: files?.length && parentWidth ? Math.ceil(files.length / c) : 0,
    };
  }, [files?.length, parentWidth]);

  const rowVirtualizer = useVirtualizer({
    count,
    getScrollElement: () => parentRef.current,
    estimateSize: () => size,
    gap,
  });

  return files ? (
    <ResizeSensor
      targetRef={parentRef}
      onResize={(e) => {
        setParentWidth(e[0].contentRect.width);
      }}
    >
      <div
        ref={parentRef}
        style={{
          overflow: 'auto', // Make it scroll!
        }}
        className={classNames(className, 'asset-grid y-scroll wide')}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const rowElements: (JSX.Element | undefined)[] = [];
            for (let i = 0; i < columns; i += 1) {
              const index = i + virtualRow.index * columns;
              if (index < files.length) {
                rowElements.push(
                  files[index] && <BundleFileEntry key={files[index].path} node={files[index]} />,
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
                key={virtualRow.key as Key}
              >
                {rowElements}
              </div>
            );
          })}
        </div>
      </div>
    </ResizeSensor>
  ) : (
    <NonIdealState
      icon={<Spinner />}
      title="Loading..."
      description="Please wait while we load a bundles..."
    />
  );
}

export default FolderFileGrid;
