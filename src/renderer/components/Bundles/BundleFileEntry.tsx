import { Icon } from '@blueprintjs/core';
import { useState } from 'react';
import { useApp } from 'renderer/contexts/AppContext';
import { getIcon } from 'renderer/scripts/file-tree';

type Props = {
  node: FileTreeNode;
  ref?: React.MutableRefObject<HTMLDivElement | null>;
};

function BundleFileEntry({ node, ref }: Props) {
  const { viewInExplorer } = useApp();

  const handleNavigation = () => {
    viewInExplorer(node.path);
  };

  const [validPreview, setValidPreview] = useState(true);

  return (
    <div title={node.name} ref={ref} className="asset" onClick={handleNavigation}>
      {validPreview ? (
        <img alt={node.name} src={`thumb://${node.path}`} onError={() => setValidPreview(false)} />
      ) : (
        <Icon icon={getIcon(node.path)} />
      )}

      <p>{node.name}</p>
    </div>
  );
}

export default BundleFileEntry;
