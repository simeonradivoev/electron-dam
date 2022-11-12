/* eslint-disable react/prop-types */
import {
  Divider,
  BreadcrumbProps,
  Tabs,
  Tab,
  Tag,
  Spinner,
  Button,
} from '@blueprintjs/core';
import { Breadcrumbs2, Popover2 } from '@blueprintjs/popover2';
import { Canvas } from '@react-three/fiber';
import { useQuery } from '@tanstack/react-query';
import { useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import { useMatch } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';
import { ImportMedia } from 'renderer/scripts/loader';
import humanFileSize from 'renderer/scripts/utils';
import BundlePreview from '../Bundles/BundlePreview';
import PreviewPanel3D from '../PreviewPanel3D';
import PreviewPanelAudio from '../PreviewPanelAudio';
import PreviewPanelImage from '../PreviewPanelImage';
import FileInfoTags from './FileInfoTags';

interface FileInfoPanelProps {
  panelSize: number;
  setSelected: (id: string | number, selected: boolean) => void;
  filter: string | undefined;
  contextMenu: (
    path: string,
    bundlePath: string | undefined,
    isDirectory: boolean
  ) => JSX.Element;
}

const FileInfoPanel: React.FC<FileInfoPanelProps> = ({
  panelSize,
  setSelected,
  filter,
  contextMenu,
}) => {
  const { database } = useContext(AppContext);
  const match = useMatch('/explorer/:file');
  const fileInfo = useQuery(
    ['fileInfo', match?.params.file],
    async (queryKey) => {
      let path = queryKey.queryKey[1];
      if (!path) {
        const transaction = database?.transaction('selected', 'readonly');
        const store = transaction?.objectStore('selected');
        const selected = await store?.getAllKeys();
        if (selected && selected.length > 0) {
          const [first] = selected;
          path = first;
        }
      }
      if (path) {
        return window.api.getFileDetails(path);
      }
      return null;
    }
  );
  const { importedMesh, importedImage, importedAudio } = ImportMedia(
    fileInfo.data
  );

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
          panelSize={panelSize}
          importedAudio={importedAudio}
        />
      </div>
    );
  } else if (fileInfo.data?.readme) {
    previewPanel = (
      <Tabs>
        <Tab
          className="preview-markdown"
          id="readme"
          title="Readme"
          panel={
            <ReactMarkdown
              className="preview-markdown-tab"
              transformImageUri={(src, alt, title) => {
                if (src.startsWith('./')) {
                  return src.replace('.', fileInfo.data?.path ?? '');
                }
                return src;
              }}
            >
              {fileInfo.data.readme}
            </ReactMarkdown>
          }
        />
      </Tabs>
    );
  } else if (fileInfo.data?.isDirectory && fileInfo.data?.bundle) {
    previewPanel = (
      <BundlePreview className="y-scroll wide" fileInfo={fileInfo.data} />
    );
  } else {
    previewPanel = <div className="preview-empty" />;
  }

  const BREADCRUMBS = useQuery<
    BreadcrumbProps[],
    unknown,
    BreadcrumbProps[],
    [FileInfo]
  >(
    [fileInfo.data ?? ({} as FileInfo)],
    (context) => {
      const [info] = context.queryKey;
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
        info.path
          .substring(info.relativePathStart + 1)
          .split('\\')
          .map((path, index, array) => {
            const crum: BreadcrumbProps = {
              onClick:
                index < array.length - 1
                  ? () => {
                      const selectPath = info.path
                        .slice(0, info.relativePathStart + 1)
                        .concat(array.slice(0, index + 1).join('\\'));
                      setSelected(selectPath, true);
                    }
                  : undefined,
              text: path,
              current: index === array.length - 1,
            };
            if (index < array.length - 1) {
              crum.icon = 'folder-close';
            } else if (info.bundle && !info.bundle.isParentBundle) {
              crum.icon = 'box';
            } else if (info.isDirectory) {
              crum.icon = 'folder-open';
            } else {
              crum.icon = 'document';
            }
            return crum;
          })
      );

      return crums;
    },
    { enabled: !!fileInfo.data, keepPreviousData: true }
  );

  return (
    <div className="file-info-panel">
      <div id="header">
        <Breadcrumbs2
          className="breadcrumbs"
          collapseFrom="end"
          overflowListProps={{ alwaysRenderOverflow: true }}
          items={
            (BREADCRUMBS.isPreviousData
              ? BREADCRUMBS.data?.concat({
                  text: <Spinner size={16} />,
                } as BreadcrumbProps)
              : BREADCRUMBS.data) ?? []
          }
        />
        <Divider />
        <Popover2
          interactionKind="click"
          position="bottom"
          minimal
          content={
            fileInfo.data ? (
              contextMenu(
                fileInfo.data.path ?? '',
                fileInfo.data.path?.substring(
                  fileInfo.data.relativePathStart + 1
                ),
                fileInfo.data.isDirectory ?? true
              )
            ) : (
              <></>
            )
          }
        >
          <Button minimal icon="menu" />
        </Popover2>
      </div>
      <Divider />
      <div className="preview-3d">
        <Canvas
          style={{ display: importedMesh.data ? 'block' : 'none' }}
          dpr={[1, 2]}
          shadows
        >
          <PreviewPanel3D importedMesh={importedMesh} />
        </Canvas>
      </div>
      {previewPanel}
      {!fileInfo.data ||
      !fileInfo.data.bundle ||
      fileInfo.data.bundle.isParentBundle ? (
        <Divider />
      ) : (
        <></>
      )}
      <ul className="file-stats">
        {fileInfo.data ? (
          <>
            {fileInfo.data.size > 0 ? (
              <Tag icon="floppy-disk" minimal>
                Size: {humanFileSize(fileInfo.data.size)}
              </Tag>
            ) : (
              <></>
            )}
          </>
        ) : (
          <Tag icon="floppy-disk" minimal>
            <Spinner size={18} />
          </Tag>
        )}
      </ul>
      <FileInfoTags
        filter={filter}
        database={database}
        fileInfo={fileInfo.data ?? null}
      />
    </div>
  );
};

export default FileInfoPanel;
