/* eslint-disable react/prop-types */
import {
  Breadcrumbs,
  BreadcrumbProps,
  Tabs,
  Tab,
  Tag,
  Spinner,
  Button,
  Navbar,
  NavbarGroup,
  NavbarDivider,
  NonIdealState,
  Classes,
  Tooltip,
  Popover,
} from '@blueprintjs/core';
import { Canvas } from '@react-three/fiber';
import { useIsMutating, useQuery } from '@tanstack/react-query';
import { join, normalize } from 'pathe';
import { useCallback, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';
import { getIcon } from 'renderer/scripts/file-tree';
import { ImportMedia } from 'renderer/scripts/loader';
import { humanFileSize, formatDuration, QueryKeys } from 'renderer/scripts/utils';
import { BundleMetaFile, zipDelimiter } from 'shared/constants';
import BundlePreview from '../Bundles/BundlePreviewBase';
import FileContextMenu from '../ExplorerPanel/FileContextMenu';
import PreviewPanel3D from '../Previews/PreviewPanel3D';
import PreviewPanelAudio from '../Previews/PreviewPanelAudio';
import PreviewPanelImage from '../Previews/PreviewPanelImage';
import FileInfoTags from './FileInfoTags';
import FolderFileGrid from './FolderFileGrid';

interface FileInfoPanelProps {
  item?: string;
  contextPortal?: HTMLElement;
  showSource?: boolean;
  searchQuery?: string;
  allowTagEditing?: boolean;
}

// eslint-disable-next-line react/function-component-definition
const FileInfoPanel: React.FC<FileInfoPanelProps> = ({
  item,
  contextPortal,
  showSource,
  searchQuery,
  allowTagEditing = true,
}) => {
  useRef();
  const { viewInExplorer, filter } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isGeneratingMetadata = useIsMutating({ mutationKey: [QueryKeys.metadata, item] }) > 0;

  const handleEditBundle = useCallback(
    (id: string | number) => {
      navigate(`/bundles/edit/${encodeURIComponent(id.toString() ?? '')}`);
    },
    [navigate],
  );

  const { data: metadata } = useQuery({
    enabled: item !== undefined,
    queryKey: [QueryKeys.metadata, item],
    queryFn: async () => {
      return window.api.getMetadata(item!).catch(() => null);
    },
  });

  const {
    data: fileInfo,
    isPending: loadingFileInfo,
    error: fileInfoError,
  } = useQuery({
    enabled: item !== undefined,
    queryKey: [QueryKeys.fileInfo, item],
    queryFn: async () => {
      return window.api.getFileDetails(item!);
    },
  });

  const { importedMesh, importedImage, importedAudio } = ImportMedia(fileInfo);

  let previewPanel;
  if (importedMesh.isEnabled) {
    previewPanel = (
      <div className="preview-3d">
        {importedMesh.error ? (
          <NonIdealState
            layout="horizontal"
            title={importedMesh.error.name}
            description={importedMesh.error.message}
            icon="error"
          />
        ) : (
          <Canvas
            style={{
              display: importedMesh.isSuccess ? 'block' : 'none',
            }}
            dpr={[1, 2]}
            shadows
          >
            <PreviewPanel3D importedMesh={importedMesh} />
          </Canvas>
        )}
        {!!importedMesh.isPending && <NonIdealState icon={<Spinner />} title="Loading" />}
      </div>
    );
  } else if (importedImage.data) {
    previewPanel = (
      <div className="preview preview-image">
        <PreviewPanelImage image={importedImage} />
      </div>
    );
  } else if (importedAudio.data) {
    previewPanel = (
      <div className="preview preview-audio">
        <PreviewPanelAudio
          path={fileInfo?.path}
          hasThumbnail={fileInfo?.hasThumbnail ?? false}
          audioMetadata={fileInfo?.audioMetadata}
          isZip={fileInfo?.isZip ?? false}
          importedAudio={importedAudio.data}
          autoPlay={searchParams.get('autoPlay') === 'true'}
        />
      </div>
    );
  } else if (fileInfo?.readme) {
    previewPanel = (
      <Tabs>
        <Tab
          className="preview preview-markdown"
          id="readme"
          title="Readme"
          panel={
            <div className="preview-markdown-tab">
              <ReactMarkdown
                skipHtml={false}
                urlTransform={(src) => {
                  if (src.startsWith('./')) {
                    return `app://${src.replace('.', fileInfo?.path ?? '')}`;
                  }
                  return src;
                }}
              >
                {fileInfo.readme}
              </ReactMarkdown>
            </div>
          }
        />
      </Tabs>
    );
  }
  // Bundles
  else if (fileInfo?.bundle && !fileInfo.bundle.isParentBundle) {
    previewPanel = (
      <BundlePreview
        searchQuery={searchQuery}
        className="preview"
        bundle={fileInfo.bundle?.bundle}
        onSelect={(s: string) => {
          viewInExplorer(s);
        }}
        onEdit={handleEditBundle}
        showFiles
      />
    );
  }
  // Folder
  else if (fileInfo?.isDirectory) {
    previewPanel = <FolderFileGrid className="preview" path={fileInfo.path} />;
  } else {
    previewPanel = <NonIdealState icon="eye-open">Select Asset to Preview</NonIdealState>;
  }

  const createBreadCrum = useCallback(
    (
      info: FileInfo,
      bundlePath: string | undefined,
      path: string,
      index: number,
      array: string[],
    ) => {
      const selectPath = join(...array.slice(0, index + 1));
      const crumb: BreadcrumbProps = {
        onClick:
          index < array.length - 1
            ? () => {
                viewInExplorer(selectPath);
              }
            : undefined,
        text: path,
        current: index === array.length - 1,
      };
      if (bundlePath && bundlePath === selectPath) {
        crumb.icon = path.endsWith(zipDelimiter) ? 'compressed' : 'box';
      } else if (info.bundle && !info.bundle.isParentBundle) {
        crumb.icon = 'box';
      } else if (info.isDirectory) {
        crumb.icon = path.endsWith(zipDelimiter) ? 'compressed' : 'folder-open';
      } else if (index === array.length - 1) {
        crumb.icon = getIcon(selectPath);
      } else {
        crumb.icon = 'folder-open';
      }
      return crumb;
    },
    [viewInExplorer],
  );

  const sourceUrl = useMemo(() => {
    try {
      return (
        fileInfo?.bundle?.bundle.bundle.sourceUrl &&
        new URL(fileInfo.bundle.bundle.bundle.sourceUrl)
      );
    } catch (error) {
      return null;
    }
  }, [fileInfo?.bundle?.bundle.bundle.sourceUrl]);

  const fileInfoPath = useMemo(
    () =>
      (showSource || fileInfo?.bundle?.bundle.isVirtual) && sourceUrl
        ? [sourceUrl.host]
        : normalize(fileInfo?.path ?? '').split('/'),
    [fileInfo?.bundle?.bundle.isVirtual, fileInfo?.path, showSource, sourceUrl],
  );

  const BREADCRUMBS = useMemo((): BreadcrumbProps[] => {
    if (!fileInfo || !fileInfoPath) {
      return [];
    }

    const info = fileInfo;
    const normalizedBundlePath = info.bundlePath ? normalize(info.bundlePath) : '';
    let crums: BreadcrumbProps[] =
      info.bundle && info.bundle.isParentBundle
        ? [
            {
              text: info.bundle.name,
              icon: 'box',
            },
          ]
        : [];

    crums = crums.concat(
      fileInfoPath.map((p, index, array) =>
        createBreadCrum(info, normalizedBundlePath, p, index, array),
      ),
    );

    return crums;
  }, [fileInfo, fileInfoPath, createBreadCrum]);

  let fileSizeTag: JSX.Element | undefined;
  if (fileInfo && fileInfo.size) {
    fileSizeTag = (
      <Tag icon="floppy-disk" minimal>
        Size: {humanFileSize(fileInfo.size)}
      </Tag>
    );
  } else if (item && loadingFileInfo) {
    fileSizeTag = (
      <Tag icon="floppy-disk" minimal>
        <Spinner size={16} />
      </Tag>
    );
  }

  return (
    <div className="file-info-panel">
      <Navbar className="header">
        <NavbarGroup>
          <Breadcrumbs className="breadcrumbs" collapseFrom="start" items={BREADCRUMBS} />
        </NavbarGroup>
        <NavbarGroup align="right">
          <NavbarDivider />
          {!!fileInfo && (
            <Popover
              interactionKind="click"
              placement="bottom"
              portalContainer={contextPortal}
              minimal
              hasBackdrop
              content={
                <FileContextMenu
                  assetPath={fileInfo.path}
                  isDirectory={fileInfo.isDirectory}
                  hasBundlePath={!!fileInfo.bundlePath}
                  navigate={navigate}
                />
              }
            >
              <Button variant="minimal" icon="menu" />
            </Popover>
          )}
        </NavbarGroup>
      </Navbar>
      {fileInfoError ? (
        <NonIdealState
          layout="horizontal"
          title={fileInfoError.name}
          description={fileInfoError.message}
          icon="error"
        />
      ) : (
        previewPanel
      )}
      {!fileInfo?.isDirectory && (
        <ul className="file-stats">
          {fileSizeTag}
          {metadata?.description && (
            <Tooltip content={<ReactMarkdown>{metadata?.description}</ReactMarkdown>}>
              <Tag
                className="description-tag"
                style={{ maxWidth: 128 }}
                icon="predictive-analysis"
                minimal
              >
                {isGeneratingMetadata ? (
                  <Spinner size={16} />
                ) : (
                  <div className={Classes.TEXT_OVERFLOW_ELLIPSIS} title="">
                    {metadata?.description}
                  </div>
                )}
              </Tag>
            </Tooltip>
          )}
          {metadata?.embeddings && (
            <Tooltip content="Embeddings">
              <Tag style={{ maxWidth: 128 }} icon="heatmap" minimal>
                {isGeneratingMetadata ? <Spinner size={16} /> : ''}
              </Tag>
            </Tooltip>
          )}
          {fileInfo?.isZip && <Tag style={{ maxWidth: 128 }} icon="compressed" minimal />}
          {fileInfo?.audioMetadata?.format.duration && (
            <Tooltip content="Duration">
              <Tag style={{ maxWidth: 128 }} icon="time" minimal>
                {formatDuration(Math.round(fileInfo?.audioMetadata?.format?.duration) * 1000)}
              </Tag>
            </Tooltip>
          )}
          {fileInfo?.audioMetadata?.format?.bitrate && (
            <Tooltip content="Bitrate (kilobits per second)">
              <Tag icon="regression-chart" minimal>
                {Math.round((fileInfo?.audioMetadata?.format?.bitrate ?? 0) * 0.001)} kbps
              </Tag>
            </Tooltip>
          )}
          {fileInfo?.audioMetadata?.common.bpm && (
            <Tooltip content="Beats per minute">
              <Tag icon="one-to-one" minimal>
                {fileInfo?.audioMetadata?.common.bpm} bpm
              </Tag>
            </Tooltip>
          )}
          {fileInfo?.audioMetadata?.format.lossless && (
            <Tooltip content="Lossless">
              <Tag icon="flame" minimal />
            </Tooltip>
          )}
        </ul>
      )}

      {!!item && (
        <div className="footer">
          <FileInfoTags allowEditing={allowTagEditing} filter={filter} item={item} />
        </div>
      )}
    </div>
  );
};

export default FileInfoPanel;
