import { Button, Icon, Menu, MenuItem, showContextMenu } from '@blueprintjs/core';
import { useQueryClient } from '@tanstack/react-query';
import { normalize } from 'pathe';
import { memo, useCallback, useState } from 'react';
import { useApp } from 'renderer/contexts/AppContext';
import { AppToaster, ShowAppToaster } from 'renderer/toaster';

interface Props {
  bundle: BundleInfo;
  onSelect: (id: string | number, e?: React.MouseEvent) => void;
  setFileInfo: (fileInfo: FileInfo | null) => void;
  handleRefresh?: () => void;

  allowDelete?: boolean;
  isSelected?: boolean;
}

/** The grid entry in Bundles grid  */
const Bundle = memo(
  ({
    bundle,
    onSelect: select,
    setFileInfo,
    handleRefresh = undefined,
    allowDelete = false,
    isSelected = false,
  }: Props) => {
    const queryClient = useQueryClient();
    const [validPreview, setValidPreview] = useState(true);
    const { viewInExplorer } = useApp();

    const handleDelete = useCallback(async () => {
      await window.api.deleteBundle(bundle.id);
      queryClient.invalidateQueries({ queryKey: ['files'] });
      setFileInfo(null);
      if (handleRefresh) {
        handleRefresh();
      }
    }, [queryClient, bundle.id, setFileInfo, handleRefresh]);

    const handleView = useCallback(() => {
      if (bundle.isVirtual) {
        window.open(bundle.id, '_blank');
      } else {
        viewInExplorer(bundle.id);
      }
    }, [bundle, viewInExplorer]);

    const contextMenu = (
      <Menu>
        <MenuItem
          disabled={bundle.isVirtual}
          icon="folder-open"
          text="View In Explorer"
          onClick={handleView}
        />
        {bundle.isVirtual && (
          <MenuItem
            icon="import"
            text="Convert to Local"
            onClick={async () => {
              try {
                await window.api.convertBundleToLocal(bundle.id);
                queryClient.invalidateQueries({ queryKey: ['bundles'] });
              } catch (error: unknown) {
                const message = error instanceof Error ? error.message : String(error);
                ShowAppToaster({
                  message: `Failed to convert bundle: ${message}`,
                  intent: 'danger',
                });
              }
            }}
          />
        )}
        {allowDelete && (
          <MenuItem intent="danger" icon="trash" text="Delete" onClick={handleDelete} />
        )}
      </Menu>
    );

    return (
      <li
        onContextMenu={(e) =>
          showContextMenu({
            content: contextMenu,
            placement: 'right-start',
            targetOffset: {
              left: e.clientX,
              top: e.clientY,
            },
          })
        }
        onClick={(e) => {
          select(bundle.id, e);
        }}
        title={bundle.name}
        className={`bundle ${isSelected ? 'active' : ''}`}
        role="button"
        draggable
      >
        <Button className={`preview ${bundle.isVirtual ? 'virtual' : ''}`} minimal>
          <Icon className="overlay-icon" icon="search" />
          <div id="properties">
            {bundle.isVirtual && <Icon title="Virtual Bundle" className="virtual" icon="cloud" />}
            {bundle.name.endsWith('.zip') && <Icon className="virtual" icon="compressed" />}
          </div>
          {validPreview ? (
            <img
              draggable={false}
              onError={() => setValidPreview(false)}
              alt={bundle.name}
              src={
                bundle.isVirtual
                  ? bundle.previewUrl
                  : `thumb://${escape(normalize(bundle.id))}?maxSize=256`
              }
            />
          ) : (
            <Icon size={64} icon={bundle.name.endsWith('.zip') ? 'compressed' : 'box'} />
          )}
        </Button>
        <p>{bundle.name}</p>
      </li>
    );
  },
);

export default Bundle;
