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
  Menu,
  OverlayToaster,
  Position,
  Toast,
  NonIdealState,
  Icon,
} from '@blueprintjs/core';
import { Breadcrumbs2, MenuItem2, Popover2 } from '@blueprintjs/popover2';
import { Canvas } from '@react-three/fiber';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dirname, join, normalize } from 'pathe';
import { useCallback, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import { useMatch, useNavigate, useSearchParams } from 'react-router-dom';
import { ContextMenuBuilder } from 'renderer/@types/preload';
import { useApp } from 'renderer/contexts/AppContext';
import { ImportMedia } from 'renderer/scripts/loader';
import { humanFileSize, formatDuration, FileTypeIcons } from 'renderer/scripts/utils';
import { AutoTagType, BundleMetaFile, zipDelimiter } from 'shared/constants';
import BundlePreview from '../Bundles/BundlePreviewBase';
import PreviewPanel3D from '../Previews/PreviewPanel3D';
import PreviewPanelAudio from '../Previews/PreviewPanelAudio';
import PreviewPanelImage from '../Previews/PreviewPanelImage';
import FileInfoTags from './FileInfoTags';
import FolderFileGrid from './FolderFileGrid';

interface FileInfoPanelProps {
  item?: string;
  contextMenu: ContextMenuBuilder;
}

// eslint-disable-next-line react/function-component-definition
const FileInfoPanel: React.FC<FileInfoPanelProps> = ({ item, contextMenu }) => {
  const { database, viewInExplorer, filter } = useApp();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const metadataMutation = useMutation<FileMetadata, Error, FileMetadata>({
    onSuccess: (_d, v, _rv, c) => {
      c.client.invalidateQueries({ queryKey: ['metadata', database] });
      c.client.setQueryData(['tags', item], _d.tags ?? []);
      return _d;
    },
    mutationKey: ['metadata', item],
  });

  async function handleEmbeddingGeneration(path: string) {
    const newMetadata = await window.api.generateEmbeddings(path);
    metadataMutation.mutate(newMetadata);
  }

  const handleEditBundle = useCallback(
    (id: string | number) => {
      navigate(`/bundles/${encodeURIComponent(id.toString() ?? '')}/edit`);
    },
    [navigate],
  );

  const metadata = useQuery({
    enabled: !!item,
    queryKey: ['metadata', item],
    queryFn: async (queryKey) => {
      const [, path] = queryKey.queryKey;
      return window.api.getMetadata(path!).catch(() => null);
    },
  });

  const {
    data: fileInfo,
    isPending: loadingFileInfo,
    error: fileInfoError,
  } = useQuery({
    enabled: !!item,
    queryKey: ['fileInfo', item],
    queryFn: async (queryKey) => {
      const [, path] = queryKey.queryKey;
      return window.api.getFileDetails(path!);
    },
  });

  const { importedMesh, importedImage, importedAudio } = ImportMedia(fileInfo);

  const autoMetadataMutation = useMutation({
    mutationKey: ['metadata', item],
    mutationFn: (type: AutoTagType) =>
      item ? window.api.autoMetadata(item, type) : Promise.reject(),
    onSuccess: (d) => {
      metadataMutation.mutate(d ?? {});
      return d;
    },
  });

  const embeddingGenerationMutation = useMutation({
    mutationKey: ['emeddings', item],
    mutationFn: async () => {
      if (item) {
        await handleEmbeddingGeneration(item);
      }
      return item;
    },
  });

  let previewPanel = <></>;
  if (importedImage.data) {
    previewPanel = (
      <div className="preview-image">
        <PreviewPanelImage image={importedImage} />
      </div>
    );
  } else if (importedAudio.data) {
    previewPanel = (
      <div className="preview-audio">
        <PreviewPanelAudio
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
          className="preview-markdown"
          id="readme"
          title="Readme"
          panel={
            <ReactMarkdown
              className="preview-markdown-tab"
              transformImageUri={(src, _alt) => {
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
  else if (fileInfo?.isDirectory && fileInfo?.bundle) {
    previewPanel = (
      <BundlePreview
        className="y-scroll wide"
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
    previewPanel = <FolderFileGrid path={fileInfo.path} />;
  } else if (!importedMesh.data && loadingFileInfo) {
    previewPanel = <NonIdealState icon={<Spinner />} title="Loading" />;
  } else {
    previewPanel = <div className="preview-empty" />;
  }

  const BREADCRUMBS = useQuery<BreadcrumbProps[], unknown, BreadcrumbProps[], [string, FileInfo]>({
    enabled: !!fileInfo,
    placeholderData: keepPreviousData,
    queryKey: ['Breadcrumb', fileInfo ?? ({} as FileInfo)],
    queryFn: (context) => {
      const [, info] = context.queryKey;
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
        normalize(info.path)
          .split('/')
          .map((path, index, array) => {
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
          }),
      );

      return crums;
    },
  });

  return (
    <div className="file-info-panel">
      <Navbar id="header ">
        <NavbarGroup>
          <Breadcrumbs2
            className="breadcrumbs"
            collapseFrom="end"
            overflowListProps={{ alwaysRenderOverflow: true }}
            items={
              (BREADCRUMBS.isPlaceholderData
                ? BREADCRUMBS.data?.concat({
                    text: <Spinner size={16} />,
                  } as BreadcrumbProps)
                : BREADCRUMBS.data) ?? []
            }
          />
        </NavbarGroup>
        <NavbarGroup align="right">
          <NavbarDivider />
          <Popover2
            interactionKind="click"
            placement="bottom"
            minimal
            content={
              fileInfo
                ? contextMenu(
                    fileInfo.path ?? '',
                    fileInfo.bundle ? fileInfo.path : undefined,
                    fileInfo.isDirectory ?? true,
                  )
                : undefined
            }
          >
            <Button minimal icon="menu" />
          </Popover2>
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
      {(!fileInfo || !fileInfo.bundle || fileInfo.bundle.isParentBundle) && <Divider />}
      <ul className="file-stats">
        {fileInfo ? (
          fileInfo.size > 0 && (
            <Tag icon="floppy-disk" minimal>
              Size: {humanFileSize(fileInfo.size)}
            </Tag>
          )
        ) : (
          <Tag icon="floppy-disk" minimal>
            <Spinner size={16} />
          </Tag>
        )}
        {metadata.data?.description && (
          <Tag style={{ maxWidth: 128 }} icon="predictive-analysis" minimal>
            {autoMetadataMutation.isPending ? <Spinner size={16} /> : metadata.data?.description}
          </Tag>
        )}
        {metadata.data?.embeddings && (
          <Tag style={{ maxWidth: 128 }} icon="heatmap" minimal title="Embeddings">
            {autoMetadataMutation.isPending ? <Spinner size={16} /> : ''}
          </Tag>
        )}
        {fileInfo?.isZip && <Tag style={{ maxWidth: 128 }} icon="compressed" minimal />}
        {fileInfo?.duration && (
          <Tag style={{ maxWidth: 128 }} icon="time" minimal title="Duration">
            {formatDuration(Math.round(fileInfo?.duration!) * 1000)}
          </Tag>
        )}
      </ul>

      <FileInfoTags
        filter={filter}
        fileInfo={fileInfo ?? null}
        contextMenu={
          <Popover2
            interactionKind="click"
            placement="top-end"
            hasBackdrop
            minimal
            content={
              <Menu>
                <MenuItem2 label="Describe" icon="barcode">
                  <MenuItem2
                    icon="predictive-analysis"
                    label="Ollama"
                    onClick={() => autoMetadataMutation.mutate(AutoTagType.Ollama)}
                  />
                  <MenuItem2
                    label="Transformers"
                    onClick={() => autoMetadataMutation.mutate(AutoTagType.Transformers)}
                  />
                </MenuItem2>
                {fileInfo?.path && (
                  <MenuItem2
                    disabled={!metadata.data?.description || embeddingGenerationMutation.isPending}
                    label="Generate Embeddings"
                    icon="predictive-analysis"
                    onClick={() => embeddingGenerationMutation.mutate()}
                  />
                )}
              </Menu>
            }
          >
            <Button
              minimal
              loading={autoMetadataMutation.isPending}
              rightIcon="caret-down"
              icon="settings"
            />
          </Popover2>
        }
      />
    </div>
  );
};

export default FileInfoPanel;
