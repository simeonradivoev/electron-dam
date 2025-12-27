import { Button, Classes, Divider, ResizeSensor } from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import { normalize } from 'pathe';
import React, { forwardRef, Key, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import BundleFileEntry from './BundleFileEntry';

type PropsTop = {
  bundle: BundleInfo | null;
  showInExplorerEnabled?: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string | number) => void;
  style?: React.CSSProperties;
};

type Props = {
  bundle: BundleInfo | null;
  className?: string;
  showFiles?: boolean;
  showInExplorerEnabled?: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string | number) => void;
  style?: React.CSSProperties;
};

const BundleTop = forwardRef<HTMLDivElement, PropsTop>(
  ({ style, bundle, onSelect: select, onEdit: edit, showInExplorerEnabled = false }, ref) => {
    return (
      <div ref={ref} style={style}>
        {bundle?.previewUrl ? (
          <div
            className="preview-image-container"
            style={{
              backgroundImage: bundle.isVirtual
                ? `url(${bundle.previewUrl})`
                : `url(app://${encodeURI(normalize(bundle.previewUrl))})`,
            }}
          >
            <img
              alt={`${bundle.name} Preview`}
              src={bundle.isVirtual ? bundle.previewUrl : `app://${normalize(bundle.previewUrl)}`}
            />
          </div>
        ) : (
          <div className="preview-image-container" />
        )}
        <Divider />
        <div className="bundle-content">
          <div className="title">
            <h1 className={bundle ? '' : Classes.SKELETON}>
              {bundle?.name ?? 'Bundle Loading Placeholder Text'}
            </h1>
            {!showInExplorerEnabled || bundle?.isVirtual ? (
              <></>
            ) : (
              <Button
                onClick={() => select(bundle!.id)}
                intent="primary"
                small
                icon="folder-open"
                title="View In Explorer"
              />
            )}
            <Button
              onClick={() => edit(bundle!.id)}
              intent="primary"
              small
              icon="edit"
              title="Edit"
            />
            {bundle?.bundle.sourceUrl ? (
              <Button
                onClick={() => window.open(bundle.bundle.sourceUrl, '_blank')}
                title={bundle.bundle.sourceUrl}
                intent="primary"
                small
                icon="link"
              />
            ) : (
              <></>
            )}
          </div>
          <ReactMarkdown
            className="description css-fix"
            transformImageUri={(src, _alt) => {
              if (src.startsWith('./')) {
                return `app://${src.replace('.', bundle?.id ?? '')}`;
              }
              return src;
            }}
          >
            {bundle?.bundle.description ?? ''}
          </ReactMarkdown>
          <Divider />
        </div>
      </div>
    );
  },
);

/**
 * This is the base preview. Will be used in the explorer as well as bundle grid info
 */
function BundlePreviewBase({
  bundle,
  className,
  onSelect,
  onEdit,
  showFiles = false,
  showInExplorerEnabled = false,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = useState<number | undefined>(undefined);

  const { data: files } = useQuery({
    enabled: !!bundle,
    queryKey: ['grid-files', bundle?.id],
    queryFn: () => window.api.getAllFiles(bundle!.id),
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
    count: count + 1,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => size,
    gap,
  });

  const firstItem = rowVirtualizer.getVirtualItems()?.[0];

  useLayoutEffect(() => {
    setParentWidth(parentRef.current?.offsetWidth);
  }, [count]);

  return (
    <ResizeSensor onResize={(e) => setParentWidth(e[0].contentRect.width)}>
      <div
        ref={parentRef}
        style={{
          height: '100%',
          overflow: 'auto', // Make it scroll!
        }}
        id="preview-bundle-parent"
        className="asset-grid y-scroll wide"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <div className={`preview-bundle ${className}`}>
            {firstItem && firstItem.index === 0 && (
              <>
                <BundleTop
                  data-index={0}
                  key={firstItem.key as Key}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${firstItem.start}px)`,
                  }}
                  ref={(r) => {
                    if (r) {
                      rowVirtualizer.resizeItem(0, r.offsetHeight);
                    }
                  }}
                  bundle={bundle}
                  onSelect={onSelect}
                  onEdit={onEdit}
                  showInExplorerEnabled={showInExplorerEnabled}
                />
                <Divider />
              </>
            )}
            {!bundle?.isVirtual &&
              showFiles &&
              files &&
              rowVirtualizer
                .getVirtualItems()
                .slice(1)
                .map((virtualRow) => {
                  const rowElements: (JSX.Element | undefined)[] = [];
                  for (let i = 0; i < columns; i += 1) {
                    const index = i + (virtualRow.index - 1) * columns;
                    if (index < files.length) {
                      rowElements.push(
                        files[index] && <BundleFileEntry key={index} node={files[index]} />,
                      );
                    }
                  }
                  return (
                    <div
                      className="row"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: `${virtualRow.size}px`,
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
      </div>
    </ResizeSensor>
  );
}

export default BundlePreviewBase;

BundlePreviewBase.defaultProps = {
  showFiles: false,
  showInExplorerEnabled: false,
};
