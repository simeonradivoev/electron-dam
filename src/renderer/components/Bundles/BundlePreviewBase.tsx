import {
  Button,
  Classes,
  Divider,
  Menu,
  MenuItem,
  Popover,
  ResizeSensor,
  Tag,
  TagInput,
  Tooltip,
} from '@blueprintjs/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { normalize } from 'pathe';
import React, { forwardRef, Key, useLayoutEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import { ProviderIcons } from 'renderer/scripts/bundles';
import { ShowAppToaster } from 'renderer/scripts/toaster';
import { Help, highlighter, QueryKeys } from 'renderer/scripts/utils';
import BundleFileEntry from './BundleFileEntry';

type PropsTop = {
  bundle: BundleInfo;
  showInExplorerEnabled?: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string | number) => void;
  style?: React.CSSProperties;
  searchQuery?: string;
};

type Props = {
  bundle: BundleInfo;
  className?: string;
  showFiles?: boolean;
  showInExplorerEnabled?: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string | number) => void;
  style?: React.CSSProperties;
  searchQuery?: string;
};

const BundleTop = forwardRef<HTMLDivElement, PropsTop>(
  (
    {
      style,
      bundle: info,
      onSelect: select,
      onEdit: edit,
      searchQuery,
      showInExplorerEnabled = false,
    },
    ref,
  ) => {
    const { bundle } = info;

    const downloadMutation = useMutation({
      mutationKey: [QueryKeys.download, info.id],
      mutationFn: (extract: boolean) => window.api.downloadBundle(info.id, extract),
      onSuccess: (d, v, r, context) => {
        context.client.invalidateQueries({ queryKey: [QueryKeys.bundles] });
      },
      onError: (e) => {
        const message = e instanceof Error ? e.message : String(e);
        ShowAppToaster({
          message: `Failed to download bundle: ${message}`,
          intent: 'danger',
        });
      },
    });

    let sourceUrl: URL | undefined;
    try {
      sourceUrl = bundle?.sourceUrl ? new URL(bundle.sourceUrl) : undefined;
    } catch {
      // empty
    }

    return (
      <div ref={ref} style={style}>
        {info?.previewUrl ? (
          <div
            className="preview-image-container"
            style={{
              backgroundImage: info.isVirtual
                ? `url(${info.previewUrl})`
                : `url(app://${encodeURI(normalize(info.previewUrl))})`,
            }}
          >
            <img
              alt={`${info.name} Preview`}
              src={info.isVirtual ? info.previewUrl : `app://${normalize(info.previewUrl)}`}
            />
          </div>
        ) : (
          <div className="preview-image-container" />
        )}
        <Divider />
        <div className="bundle-content">
          <div className="title">
            <h1 className={bundle ? '' : Classes.SKELETON}>
              {info?.name ?? 'Bundle Loading Placeholder Text'}
            </h1>
            {!info?.isVirtual && bundle?.sourceType && (
              <Tooltip content={bundle.sourceType}>
                <Tag size="large" icon={ProviderIcons[bundle.sourceType]} />
              </Tooltip>
            )}
            {!!(bundle as AnyMetadata)?.embeddings && (
              <Tooltip
                content={Help.text.embeddings}
                position="bottom"
                hoverOpenDelay={Help.popUpDelay}
              >
                <Tag size="large" minimal icon="heatmap" />
              </Tooltip>
            )}
            {!showInExplorerEnabled || info?.isVirtual ? (
              <></>
            ) : (
              <Tooltip
                content={Help.text.bundleViewInExplorer}
                position="bottom"
                hoverOpenDelay={Help.popUpDelay}
              >
                <Button
                  onClick={() => select(info?.id)}
                  intent="primary"
                  size="small"
                  icon="folder-open"
                />
              </Tooltip>
            )}
            <Tooltip
              hoverOpenDelay={Help.popUpDelay}
              content={Help.text.editBundle}
              position="bottom"
            >
              <Button onClick={() => edit(info!.id)} intent="primary" size="small" icon="edit" />
            </Tooltip>
            {sourceUrl ? (
              <Tooltip content={sourceUrl.href} position="bottom">
                <Button
                  onClick={() => window.open(sourceUrl, '_blank')}
                  intent="primary"
                  size="small"
                  icon="link"
                >
                  {sourceUrl.host}
                </Button>
              </Tooltip>
            ) : (
              <></>
            )}
            {info?.isVirtual && bundle?.sourceType && (
              <Popover
                minimal
                position="bottom-right"
                content={
                  <Menu>
                    <Tooltip
                      hoverOpenDelay={Help.popUpDelay}
                      content={Help.text.downloadBundleNonExtract}
                    >
                      <MenuItem
                        icon="download"
                        text="Download"
                        onClick={() => downloadMutation.mutate(false)}
                      />
                    </Tooltip>
                    <Tooltip
                      hoverOpenDelay={Help.popUpDelay}
                      content={Help.text.downloadBundleExtract}
                    >
                      <MenuItem
                        icon="download"
                        text="Download & Extract"
                        onClick={() => downloadMutation.mutate(true)}
                      />
                    </Tooltip>
                  </Menu>
                }
              >
                <Button icon={ProviderIcons[bundle.sourceType]} intent="primary" endIcon="download">
                  Download
                </Button>
              </Popover>
            )}
          </div>
          <div className="description css-fix">
            <ReactMarkdown
              skipHtml={false}
              rehypePlugins={[rehypeRaw as any]}
              urlTransform={(src) => {
                if (src.startsWith('./')) {
                  return `app://${src.replace('.', info?.id ?? '')}`;
                }
                return src;
              }}
            >
              {bundle?.description
                ? searchQuery
                  ? highlighter.highlight(bundle.description, searchQuery).HTML
                  : bundle.description
                : ''}
            </ReactMarkdown>
          </div>
          {showInExplorerEnabled && (
            <div className="tags">
              {bundle?.tags?.map((t) => (
                <Tag minimal>{t}</Tag>
              ))}
            </div>
          )}
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
  searchQuery,
  showFiles = false,
  showInExplorerEnabled = false,
}: Props) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [parentWidth, setParentWidth] = useState<number | undefined>(undefined);

  const { data: files } = useQuery({
    enabled: !!bundle && !bundle.isVirtual,
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

  return (
    <ResizeSensor targetRef={parentRef} onResize={(e) => setParentWidth(e[0].contentRect.width)}>
      <div
        ref={parentRef}
        style={{
          height: '100%',
          overflow: 'auto', // Make it scroll!
        }}
        id="preview-bundle-parent"
        className={classNames(className, 'asset-grid y-scroll wide')}
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          <div className="preview-bundle">
            {firstItem && firstItem.index === 0 && (
              <>
                <BundleTop
                  data-index={0}
                  searchQuery={searchQuery}
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
