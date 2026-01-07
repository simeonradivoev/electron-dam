/* eslint-disable react/prop-types */
import {
  Divider,
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
} from '@blueprintjs/core';
import { Breadcrumbs2, Popover2, Tooltip2 } from '@blueprintjs/popover2';
import { Canvas } from '@react-three/fiber';
import { keepPreviousData, useIsMutating, useQuery } from '@tanstack/react-query';
import { join, normalize } from 'pathe';
import { useCallback, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';
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
      navigate(`/bundles/${encodeURIComponent(id.toString() ?? '')}/edit`);
    },
    [navigate],
  );

  const { data: metadata } = useQuery({
    enabled: !!item,
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
    enabled: !!item,
    queryKey: [QueryKeys.fileInfo, item],
    queryFn: async () => {
      return window.api.getFileDetails(item!);
    },
  });

  const { importedMesh, importedImage, importedAudio } = ImportMedia(fileInfo);

  let previewPanel;
  if (importedImage.data) {
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
            <ReactMarkdown
              className="preview-markdown-tab"
              skipHtml={false}
              transformImageUri={(src) => {
                if (src.startsWith('./')) {
                  return `app://${src.replace('.', fileInfo?.path ?? '')}`;
                }
                return src;
              }}
            >
              {fileInfo.readme}
            </ReactMarkdown>
          }
        />
      </Tabs>
    );
  }
  // Bundles
  else if (fileInfo?.bundle) {
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
  } else if (!importedMesh.data && item && loadingFileInfo) {
    previewPanel = <NonIdealState icon={<Spinner />} title="Loading" />;
  } else {
    previewPanel = <NonIdealState icon="eye-open">Select Asset to Preview</NonIdealState>;
  }

  function createBreadCrum(
    info: FileInfo,
    bundlePath: string | undefined,
    path: string,
    index: number,
    array: string[],
  ) {
    const selectPath = join(...array.slice(0, index + 1));
    const crum: BreadcrumbProps = {
      onClick:
        index < array.length - 1
          ? () => {
              viewInExplorer(selectPath);
            }
          : undefined,
      text: path,
      current: index === array.length - 1,
    };
    if (index < array.length - 1) {
      if (bundlePath && bundlePath === selectPath) {
        crum.icon = path.endsWith(zipDelimiter) ? 'compressed' : 'box';
      } else {
        crum.icon = 'folder-open';
      }
    } else if (info.bundle && !info.bundle.isParentBundle) {
      crum.icon = 'box';
    } else if (info.isDirectory) {
      crum.icon = path.endsWith(zipDelimiter) ? 'compressed' : 'folder-open';
    } else {
      crum.icon = 'document';
    }
    return crum;
  }

  const sourceUrl =
    fileInfo?.bundle?.bundle.bundle.sourceUrl && new URL(fileInfo.bundle.bundle.bundle.sourceUrl);
  const fileInfoPath =
    (showSource || fileInfo?.bundle?.bundle.isVirtual) && sourceUrl
      ? [sourceUrl.host]
      : normalize(fileInfo?.path ?? '').split('/');

  const BREADCRUMBS = useMemo((): BreadcrumbProps[] => {
    if (!fileInfo || !fileInfoPath) {
      return [];
    }

    const info = fileInfo;
    const normalizedBundlePath = info.bundlePath && normalize(info.bundlePath);
    const bundlePath =
      normalizedBundlePath &&
      normalizedBundlePath.substring(0, normalizedBundlePath.length - BundleMetaFile.length - 1);
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
      fileInfoPath.map((p, index, array) => createBreadCrum(info, bundlePath, p, index, array)),
    );

    return crums;
  }, [
    fileInfoPath,
    !fileInfo,
    fileInfo?.bundlePath,
    fileInfo?.bundle,
    fileInfo?.path,
    viewInExplorer,
  ]);

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
          <Breadcrumbs2 className="breadcrumbs" collapseFrom="start" items={BREADCRUMBS} />
        </NavbarGroup>
        <NavbarGroup align="right">
          <NavbarDivider />
          {!!fileInfo && (
            <Popover2
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
              <Button minimal icon="menu" />
            </Popover2>
          )}
        </NavbarGroup>
      </Navbar>
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
              display: importedMesh.isSuccess || importedMesh.isFetched ? 'block' : 'none',
            }}
            dpr={[1, 2]}
            shadows
          >
            <PreviewPanel3D importedMesh={importedMesh} />
          </Canvas>
        )}
      </div>
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
            <Tooltip2 content={<ReactMarkdown>{metadata?.description}</ReactMarkdown>}>
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
            </Tooltip2>
          )}
          {metadata?.embeddings && (
            <Tooltip2 content="Embeddings">
              <Tag style={{ maxWidth: 128 }} icon="heatmap" minimal>
                {isGeneratingMetadata ? <Spinner size={16} /> : ''}
              </Tag>
            </Tooltip2>
          )}
          {fileInfo?.isZip && <Tag style={{ maxWidth: 128 }} icon="compressed" minimal />}
          {fileInfo?.audioMetadata?.format.duration && (
            <Tooltip2 content="Duration">
              <Tag style={{ maxWidth: 128 }} icon="time" minimal>
                {formatDuration(Math.round(fileInfo?.audioMetadata?.format?.duration) * 1000)}
              </Tag>
            </Tooltip2>
          )}
          {fileInfo?.audioMetadata?.format?.bitrate && (
            <Tooltip2 content="Bitrate (kilobits per second)">
              <Tag icon="regression-chart" minimal>
                {Math.round((fileInfo?.audioMetadata?.format?.bitrate ?? 0) * 0.001)} kbps
              </Tag>
            </Tooltip2>
          )}
          {fileInfo?.audioMetadata?.common.bpm && (
            <Tooltip2 content="Beats per minute">
              <Tag icon="one-to-one" minimal>
                {fileInfo?.audioMetadata?.common.bpm} bpm
              </Tag>
            </Tooltip2>
          )}
          {fileInfo?.audioMetadata?.format.lossless && (
            <Tooltip2 content="Lossless">
              <Tag icon="flame" minimal />
            </Tooltip2>
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
