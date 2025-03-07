
import {
  Button,
  Icon,
  Menu,
  Position,
  Spinner
} from '@blueprintjs/core';
import { ContextMenu2, IPopover2Props, MenuItem2 } from '@blueprintjs/popover2';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useContext } from 'react';
import { AppContext } from 'renderer/AppContext';

interface Props {
  bundle: BundleInfo;
  onSelect: (id: string | number) => void;
  setFileInfo: (fileInfo: FileInfo | null) => void;
  handleRefresh?: () => void;

  allowDelete?: boolean;
}

const Bundle = ({
  bundle,
  onSelect: select,
  setFileInfo,
  handleRefresh = undefined,
  allowDelete = false,
}: Props) => {
  const queryClient = useQueryClient();
  const { viewInExplorer } = useContext(AppContext);
  const isSelected = false;

  const thumbnail = useQuery(
    ['thumbanil', bundle.id, bundle.previewUrl, bundle.isVirtual],
    async ({
      queryKey,
    }: {
      queryKey: [
        key: string,
        id: string,
        previewUrl: string | undefined,
        isVirtual: boolean
      ];
    }) => {
      const [key, id, previewPath, isVirtual] = queryKey;
      if (isVirtual) {
        return previewPath;
      }
      if (previewPath) {
        return window.api.getPreview(previewPath, 128);
      }
      return window.api.getPreview(id, 128);
    }
  );

  const handleDelete = useCallback(async () => {
    await window.api.deleteBundle(bundle.id);
    queryClient.invalidateQueries(['files']);
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

  return (
    <ContextMenu2
      popoverProps={{ position: Position.RIGHT_TOP } as IPopover2Props}
      title={bundle.name}
      className={`bundle ${isSelected ? 'active' : ''}`}
      content={
        <Menu>
          <MenuItem2
            disabled={bundle.isVirtual}
            icon="folder-open"
            text="View In Explorer"
            onClick={handleView}
          />
          {allowDelete && (
            <MenuItem2
              intent="danger"
              icon="trash"
              text="Delete"
              onClick={handleDelete}
            />
          )}
        </Menu>
      }
    >
      <Button
        className={`preview ${bundle.isVirtual ? 'virtual' : ''}`}
        minimal
        onClick={() => {
          select(bundle.id);
        }}
      >
        <Icon className="overlay-icon" icon="search" />
        <div id="properties">
          {bundle.isVirtual && (
            <Icon title="Virtual Bundle" className="virtual" icon="cloud" />
          )}
        </div>
        {thumbnail ? (
          <img alt={bundle.name} src={thumbnail.data} />
        ) : (
          <Spinner />
        )}
      </Button>
      <p>{bundle.name}</p>
    </ContextMenu2>
  );
};

Bundle.defaultProps = {
  handleRefresh: undefined,
  allowDelete: false,
};

export default Bundle;
