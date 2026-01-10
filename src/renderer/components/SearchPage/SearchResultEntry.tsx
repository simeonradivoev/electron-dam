/* eslint-disable react/require-default-props */
import {
  Icon,
  TreeNodeInfo,
  Tag,
  Classes,
  IconName,
  MaybeElement,
  Intent,
  showContextMenu,
} from '@blueprintjs/core';
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
import { highlighter } from 'renderer/scripts/utils';
import { FileType } from 'shared/constants';

interface Props {
  node: TreeNodeInfo<SearchEntryResult>;
  isSelected?: boolean;
  searchTerm: string | undefined;
  onClick: MouseEventHandler<HTMLLIElement>;
  onDoubleClick: MouseEventHandler<HTMLLIElement>;
  onKeyDown: KeyboardEventHandler<HTMLLIElement>;
  contextMenu: (node: TreeNodeInfo<SearchEntryResult>) => JSX.Element;
  ref: MutableRefObject<HTMLLIElement | null> | undefined;
}

const SearchResultEntry = memo(
  ({
    node,
    onClick,
    onDoubleClick,
    onKeyDown,
    ref,
    contextMenu,
    searchTerm,
    isSelected = false,
  }: Props) => {
    const localRef = useRef<HTMLLIElement>(null);
    const [validPreview, setValidPreview] = useState(true);

    const score = node.nodeData?.score ?? 0;
    const labelHighlighted = searchTerm
      ? highlighter.highlight(node.label as string, searchTerm).HTML
      : (node.label as string);
    const highlightedTags = node.nodeData?.tags?.map(
      (t, index): { index: number; tag: string; intent: Intent; minimal: boolean } => {
        if (searchTerm) {
          const highlights = highlighter.highlight(t, searchTerm);
          return {
            index,
            tag: t,
            intent: highlights.positions.length > 0 ? 'primary' : 'none',
            minimal: highlights.positions.length <= 0,
          };
        }

        return { index, tag: t, intent: 'none', minimal: true };
      },
    );

    let scoreIntent: 'success' | 'warning' | 'danger' | 'none' = 'none';
    if (score > 0.8) {
      scoreIntent = 'success';
    } else if (score > 0.6) {
      scoreIntent = 'warning';
    } else if (score > 0.5) {
      scoreIntent = 'danger';
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

    let preview: JSX.Element | undefined;
    if (node.nodeData?.isVirtual && node.nodeData?.virtualPreview) {
      preview = <img alt={node.nodeData.filename} src={node.nodeData?.virtualPreview} />;
    } else if (validPreview) {
      preview = (
        <img
          alt={node.nodeData?.filename}
          onError={() => setValidPreview(false)}
          src={`thumb://${node.nodeData?.path}`}
        />
      );
    } else {
      preview = <Icon icon={node.icon} size={24} />;
    }

    let typeIcon: IconName | MaybeElement | undefined;
    if (node.nodeData?.fileType === FileType.Bundle) {
      if (node.nodeData.isArchived) {
        typeIcon = 'archive';
      } else if (node.nodeData.isVirtual) {
        typeIcon = 'cloud';
      } else {
        typeIcon = 'box';
      }
    } else {
      typeIcon = node.icon;
    }

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
        <div className="search-result-preview">{preview}</div>

        <div className="search-result-content">
          <div className={cn('search-result-name')} title={node.nodeData?.filename}>
            <span dangerouslySetInnerHTML={{ __html: labelHighlighted }} />
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
                minimal={node.nodeData?.fileType !== FileType.Bundle}
                title={node.nodeData?.fileType}
                intent="primary"
                icon={typeIcon}
              />
              {highlightedTags?.map((t) => (
                <Tag intent={t.intent} minimal={t.minimal} key={t.index}>
                  {t.tag}
                </Tag>
              ))}
            </div>
          )}
        </div>

        <div className="search-result-score">
          <Tag large intent={scoreIntent} minimal className="score-tag">
            {score.toLocaleString(undefined, { style: 'percent' })}
          </Tag>
        </div>
      </li>
    );
  },
);

export default SearchResultEntry;
