/* eslint-disable react/require-default-props */
import { Icon, TreeNodeInfo, Tag, Classes } from '@blueprintjs/core';
import { showContextMenu } from '@blueprintjs/popover2';
import cn from 'classnames';
import {
  useRef,
  useState,
  MouseEventHandler,
  KeyboardEventHandler,
  MutableRefObject,
  useCallback,
  memo,
} from 'react';
import { getIcon } from 'renderer/scripts/file-tree';
import { FileType } from 'shared/constants';

interface Props {
  node: TreeNodeInfo<SearchTreeNode>;
  isSelected?: boolean;
  onClick: MouseEventHandler<HTMLLIElement>;
  onDoubleClick: MouseEventHandler<HTMLLIElement>;
  onKeyDown: KeyboardEventHandler<HTMLLIElement>;
  contextMenu: (node: TreeNodeInfo<SearchTreeNode>) => JSX.Element;
  ref: MutableRefObject<HTMLLIElement | null> | undefined;
}

const SearchResultEntry = memo(
  ({ node, onClick, onDoubleClick, onKeyDown, ref, contextMenu, isSelected = false }: Props) => {
    const localRef = useRef<HTMLLIElement>(null);
    const [validPreview, setValidPreview] = useState(true);

    const score = node.nodeData?.score ?? 0;
    const scorePercentage = (score * 100).toFixed(0);

    let scoreIntent: 'success' | 'warning' | 'none' = 'none';
    if (score > 0.8) {
      scoreIntent = 'success';
    } else if (score > 0.5) {
      scoreIntent = 'warning';
    }

    const handleContextMenu = useCallback(
      (e: React.MouseEvent<HTMLLIElement>) => {
        showContextMenu({
          content: contextMenu(node),
          targetOffset: { left: e.clientX, top: e.clientY },
        });
      },
      [contextMenu, node],
    );

    return (
      <li
        ref={ref ?? localRef}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        onContextMenu={handleContextMenu}
        className={cn('search-result-entry', Classes.INTENT_PRIMARY, Classes.PANEL_STACK2, {
          selected: isSelected,
        })}
        role="button"
      >
        <div className="search-result-preview">
          {validPreview ? (
            <img
              alt={node.nodeData?.name}
              onError={() => setValidPreview(false)}
              src={`thumb://${node.nodeData?.path}`}
            />
          ) : (
            <Icon icon={node.icon} size={24} />
          )}
        </div>

        <div className="search-result-content">
          <div className={cn('search-result-name')} title={node.nodeData?.name}>
            {node.label}
          </div>

          <div
            className={cn(
              'search-result-path',
              Classes.TEXT_MUTED,
              Classes.TEXT_SMALL,
              Classes.TEXT_OVERFLOW_ELLIPSIS,
            )}
          >
            {node.nodeData?.path}
          </div>

          {node.nodeData && (
            <div className="search-result-tags">
              <Tag
                minimal
                intent={node.nodeData?.fileType === FileType.Bundle ? 'primary' : 'none'}
                icon={node.nodeData?.fileType === FileType.Bundle ? 'box' : node.icon}
              />
              {node.nodeData.tags?.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          )}
        </div>

        <div className="search-result-score">
          <Tag large intent={scoreIntent} minimal className="score-tag">
            {scorePercentage}%
          </Tag>
        </div>
      </li>
    );
  },
);

export default SearchResultEntry;
