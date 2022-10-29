import { Icon, Spinner, TreeNodeInfo } from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useIntersection } from 'renderer/scripts/interactionObserver';

type Props = {
  node: TreeNodeInfo<FileTreeNode>;
};

const BundleFileEntry = ({ node }: Props) => {
  const [isInView, setIsInView] = useState(false);
  const preview = useQuery<string | null>(
    [node.nodeData?.path],
    async () => {
      return (
        (await window.api.getPreview(node.nodeData?.path ?? '', 128)) ?? null
      );
    },
    { enabled: isInView }
  );
  const elementRef = useRef<HTMLDivElement | null>(null);

  useIntersection(elementRef, () => {
    setIsInView(true);
  });

  return (
    <div title={node.nodeData?.name} ref={elementRef} className="asset">
      {isInView && (
        <>
          {preview.data ? (
            <img alt={node.nodeData?.name} src={preview.data} />
          ) : (
            <Icon icon={node.icon} />
          )}

          {node.label}
        </>
      )}
    </div>
  );
};

export default BundleFileEntry;
