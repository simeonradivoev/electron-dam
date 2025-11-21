import { Icon, Spinner, TreeNodeInfo } from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import { useContext, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';
import { useIntersection } from 'renderer/scripts/interactionObserver';

type Props = {
  node: TreeNodeInfo<FileTreeNode>;
};

const BundleFileEntry = ({ node }: Props) => {
  const [isInView, setIsInView] = useState(false);
  const { viewInExplorer } = useContext(AppContext);

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
  const navigate = useNavigate();

  useIntersection(elementRef, () => {
    setIsInView(true);
  });

  const handleNavigation = () => {
    viewInExplorer(node.id);
  };

  return (
    <div
      title={node.nodeData?.name}
      ref={elementRef}
      className="asset"
      onClick={handleNavigation}
    >
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
