import {
  Button,
  Icon,
  Menu,
  Position,
  Spinner,
  TreeNodeInfo,
} from '@blueprintjs/core';
import { ContextMenu2, IPopover2Props, MenuItem2 } from '@blueprintjs/popover2';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

type Props = {
  info: TreeNodeInfo;
  node: FileTreeNode;
  onSelect: (id: string | number) => void;
  viewInExplorer: (id: string | number) => void;
  setFileInfo: (fileInfo: FileInfo | null) => void;
};

const Bundle = ({
  node,
  info,
  onSelect: select,
  viewInExplorer,
  setFileInfo,
}: Props) => {
  const queryClient = useQueryClient();

  const thumbnail = useQuery(['thumbanil', node.previewPath], async () => {
    if (node.previewPath) {
      return window.api.getPreview(node.previewPath, 128);
    }
    return window.api.getPreview(node.path, 128);
  });

  const handleDelete = useCallback(async () => {
    await window.api.deleteBundle(node.path);
    queryClient.invalidateQueries(['files']);
    setFileInfo(null);
  }, [queryClient, node.path, setFileInfo]);

  return (
    <ContextMenu2
      popoverProps={{ position: Position.RIGHT_TOP } as IPopover2Props}
      className={`bundle ${info.isSelected ? 'active' : ''}`}
      content={
        <Menu>
          <MenuItem2
            icon="folder-open"
            text="View In Explorer"
            onClick={() => viewInExplorer(info.id)}
          />
          <MenuItem2
            intent="danger"
            icon="trash"
            text="Delete"
            onClick={handleDelete}
          />
        </Menu>
      }
    >
      <Button
        className="preview"
        minimal
        onClick={() => {
          select(info.id);
        }}
      >
        <Icon className="overlay-icon" icon="search" />
        {thumbnail ? <img alt={node.name} src={thumbnail.data} /> : <Spinner />}
      </Button>
      <p>{node.name}</p>
    </ContextMenu2>
  );
};

export default Bundle;
