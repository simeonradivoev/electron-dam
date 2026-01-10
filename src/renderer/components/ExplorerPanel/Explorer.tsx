import { Popover, PopupKind } from '@blueprintjs/core';
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Split from 'react-split';
import { ShowContextMenuParams } from 'renderer/@types/preload';
import { useApp } from 'renderer/contexts/AppContext';
import FileInfoPanel from '../FileInfoPanel/FileInfoPanel';
import ExplorerBar from './ExplorerBar';
import FileContextMenu from './FileContextMenu';

function Explorer() {
  const { viewInExplorer, focusedItem, typeFilter, sideBarSize, setSideBarSize } = useApp();
  const navigate = useNavigate();
  const [contextMenuTarget, setContextMenuTarget] = useState<ShowContextMenuParams | undefined>(
    undefined,
  );

  const handleQuickAction = useCallback((e: KeyboardEvent) => {
    document.dispatchEvent(new CustomEvent('quickAction', { detail: e }));
  }, []);

  return (
    <>
      {contextMenuTarget && (
        <Popover
          content={<FileContextMenu assetPath={contextMenuTarget.id} navigate={navigate} />}
          isOpen={!!contextMenuTarget}
          popupKind={PopupKind.MENU}
          minimal
          position="bottom"
          positioningStrategy="absolute"
          targetProps={{
            style: {
              top: contextMenuTarget.rect.y,
              left: contextMenuTarget.rect.x,
              width: contextMenuTarget.rect.width,
              height: contextMenuTarget.rect.height,
              position: 'absolute',
            },
          }}
          hasBackdrop
          onInteraction={(open) => {
            if (!open) setContextMenuTarget(undefined);
          }}
        >
          <div id="context-menu-target" />
        </Popover>
      )}
      <Split
        direction="horizontal"
        cursor="col-resize"
        className="wrap"
        snapOffset={30}
        minSize={100}
        expandToMin={false}
        gutterSize={5}
        sizes={[sideBarSize, 100 - sideBarSize]}
        onDragEnd={(size) => {
          setSideBarSize(size[0]);
        }}
      >
        <ExplorerBar
          focusedItem={focusedItem}
          setFocusedItem={(e) => viewInExplorer(e as string)}
          typeFilter={typeFilter}
          contextMenu={setContextMenuTarget}
          quickAction={handleQuickAction}
        />
        <FileInfoPanel item={focusedItem} />
      </Split>
    </>
  );
}

export default Explorer;
