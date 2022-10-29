/* eslint-disable react/prop-types */
import {
  Divider,
  BreadcrumbProps,
  Tabs,
  Tab,
  Tag,
  Spinner,
  Classes,
  IBreadcrumbProps,
} from '@blueprintjs/core';
import { Breadcrumbs2 } from '@blueprintjs/popover2';
import { Canvas } from '@react-three/fiber';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { IDBPDatabase } from 'idb';
import ReactMarkdown from 'react-markdown';
import humanFileSize from 'renderer/scripts/utils';
import BundlePreview from '../Bundles/BundlePreview';
import PreviewPanel3D from '../PreviewPanel3D';
import PreviewPanelAudio from '../PreviewPanelAudio';
import PreviewPanelImage from '../PreviewPanelImage';
import FileInfoTags from './FileInfoTags';

interface FileInfoPanelProps {
  fileInfo: FileInfo | null;
  importedMesh: UseQueryResult<any | null, unknown>;
  importedImage: UseQueryResult<string | null, unknown>;
  importedAudio: UseQueryResult<string | null, unknown>;
  panelSize: number;
  database: IDBPDatabase<FilesDB> | undefined;
  setSelected: (id: string | number, selected: boolean) => void;
  filter: string | undefined;
}

const FileInfoPanel: React.FC<FileInfoPanelProps> = ({
  database,
  panelSize,
  fileInfo,
  importedMesh,
  importedImage,
  importedAudio,
  setSelected,
  filter,
}) => {
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
              transformImageUri={(src, alt, title) => {
                if (src.startsWith('./')) {
                  return src.replace('.', fileInfo.path);
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
  } else if (fileInfo?.isDirectory && fileInfo?.bundle) {
    previewPanel = <BundlePreview fileInfo={fileInfo} />;
  }

  const BREADCRUMBS = useQuery<
    BreadcrumbProps[],
    unknown,
    BreadcrumbProps[],
    [FileInfo]
  >(
    [fileInfo ?? ({} as FileInfo)],
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
    { enabled: !!fileInfo, keepPreviousData: true }
  );

  return (
    <div className="file-info-panel">
      <Breadcrumbs2
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
      {!fileInfo || !fileInfo.bundle || fileInfo.bundle.isParentBundle ? (
        <Divider />
      ) : (
        <></>
      )}
      <ul className="file-stats">
        {fileInfo ? (
          <>
            {fileInfo.size > 0 ? (
              <Tag icon="floppy-disk" minimal>
                Size: {humanFileSize(fileInfo.size)}
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
      <FileInfoTags filter={filter} database={database} fileInfo={fileInfo} />
    </div>
  );
};

export default FileInfoPanel;
