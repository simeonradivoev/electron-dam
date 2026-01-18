import { Button, Icon, Menu, MenuItem, showContextMenu, Tooltip } from '@blueprintjs/core';
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import classNames from 'classnames';
import { normalize } from 'pathe';
import { memo, useCallback, useMemo, useState } from 'react';
import { useApp } from 'renderer/contexts/AppContext';
import { ProviderIcons } from 'renderer/scripts/bundles';
import { ShowAppToaster } from 'renderer/scripts/toaster';
import { Help, QueryKeys } from 'renderer/scripts/utils';
import { LoginProvider } from 'shared/constants';

interface Props {
  bundle: BundleInfo;
  onSelect: (id: string | number, e?: React.MouseEvent) => void;
  allowDelete?: boolean;
  isSelected?: boolean;
}

/** The grid entry in Bundles grid  */
const Bundle = memo(
  ({ bundle, onSelect: select, allowDelete = false, isSelected = false }: Props) => {
    const [validPreview, setValidPreview] = useState(true);
    const { viewInExplorer } = useApp();
    const isConverting = useIsMutating({ mutationKey: [QueryKeys.convert] }) > 0;
    const isDownloading = useIsMutating({ mutationKey: [QueryKeys.download] }) > 0;

    const convertToLocalBundleMutation = useMutation({
      mutationKey: [QueryKeys.convert, bundle.id],
      mutationFn: () => window.api.convertBundleToLocal(bundle.id),
      onSuccess: (d, v, r, context) => {
        context.client.invalidateQueries({ queryKey: [QueryKeys.bundles] });
      },
      onError: (e) => {
        const message = e instanceof Error ? e.message : String(e);
        ShowAppToaster({
          message: `Failed to convert bundle: ${message}`,
          intent: 'danger',
        });
      },
    });

    const downloadMutation = useMutation({
      mutationKey: [QueryKeys.download, bundle.id],
      mutationFn: (extract: boolean) => window.api.downloadBundle(bundle.id, extract),
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

    const deleteMutation = useMutation({
      mutationKey: [QueryKeys.delete, bundle.id],
      mutationFn: () => window.api.deleteBundle(bundle.id),
      onSuccess: (d, v, r, context) => {
        context.client.invalidateQueries({ queryKey: [QueryKeys.bundles] });
      },
    });

    const handleView = useCallback(() => {
      if (bundle.isVirtual) {
        window.open(bundle.id, '_blank');
      } else {
        viewInExplorer(bundle.id);
      }
    }, [bundle, viewInExplorer]);

    const contextMenu = useMemo(
      () => (
        <Menu>
          <MenuItem
            disabled={bundle.isVirtual}
            icon="folder-open"
            text="View In Explorer"
            onClick={handleView}
          />
          {bundle.isVirtual && (
            <>
              <MenuItem
                icon="import"
                text="Convert to Local"
                disabled={isConverting}
                onClick={() => convertToLocalBundleMutation.mutate()}
              />
              <MenuItem icon="download" text="Download" disabled={isDownloading}>
                <Tooltip
                  content={Help.text.downloadBundleNonExtract}
                  hoverOpenDelay={Help.popUpDelay}
                >
                  <MenuItem
                    icon="download"
                    onClick={() => downloadMutation.mutate(false)}
                    text="Download"
                  />
                </Tooltip>
                <Tooltip content={Help.text.downloadBundleExtract} hoverOpenDelay={Help.popUpDelay}>
                  <MenuItem
                    icon="download"
                    onClick={() => downloadMutation.mutate(true)}
                    text="Download & Extract"
                  />
                </Tooltip>
              </MenuItem>
            </>
          )}
          {!!bundle.bundle?.sourceUrl && (
            <MenuItem
              text="Open Link"
              icon="link"
              onClick={() => window.open(bundle.bundle.sourceUrl, '_blank')}
            />
          )}
          {allowDelete && (
            <MenuItem
              intent="danger"
              icon="trash"
              text="Delete"
              onClick={() => deleteMutation.mutate()}
            />
          )}
        </Menu>
      ),
      [
        allowDelete,
        bundle.isVirtual,
        convertToLocalBundleMutation,
        deleteMutation,
        handleView,
        isConverting,
      ],
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
        <Button className={classNames(`preview`, { virtual: bundle.isVirtual })} variant="minimal">
          <Icon className="overlay-icon" icon="search" />
          <div id="properties">
            {bundle.name.endsWith('.zip') && <Icon className="virtual" icon="compressed" />}
            {bundle.isVirtual && <Icon title="Virtual Bundle" className="virtual" icon="cloud" />}
            {!!bundle.bundle?.sourceType && !!ProviderIcons[bundle.bundle.sourceType] && (
              <span className="bp6-icon bp6-icon-cloud virtual">
                {ProviderIcons[bundle.bundle.sourceType]}
              </span>
            )}
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
