import { Icon } from '@blueprintjs/core';
import { normalize } from 'pathe';
import { memo, useMemo, useState } from 'react';
import { useApp } from 'renderer/contexts/AppContext';
import { getIcon } from 'renderer/scripts/file-tree';

type Props = {
  node: FileTreeNode;
  ref?: React.MutableRefObject<HTMLDivElement | null>;
};

const BundleFileEntry = memo(({ node, ref }: Props) => {
  const { viewInExplorer } = useApp();

  const handleNavigation = () => {
    viewInExplorer(node.path);
  };

  const [validPreview, setValidPreview] = useState(true);
  const iconName = getIcon(node.path);
  const icon = useMemo(() => <Icon icon={iconName} />, [iconName]);
  const preview = useMemo(
    () => (
      <img
        alt=""
        src={`thumb://${escape(normalize(node.path))}`}
        onError={() => setValidPreview(false)}
      />
    ),
    [node.path],
  );

  return (
    <div title={node.name} ref={ref} className="asset" onClick={handleNavigation}>
      {validPreview ? preview : icon}

      <p>{node.name}</p>
    </div>
  );
});

export default BundleFileEntry;
