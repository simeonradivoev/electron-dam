import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';
import BundlePreview from './BundlePreviewBase';

export type Params = {
  bundle: BundleInfo;
};

/**
 * This is the bundle preview that is shown in the bundles tab not in the explorer
 */
function BundleInfoPreview({ bundle }: Params) {
  const navigate = useNavigate();

  const { viewInExplorer } = useApp();

  const handleView = useCallback(() => {
    viewInExplorer(bundle.id);
  }, [bundle, viewInExplorer]);

  const handleEditBundle = useCallback(
    (id: string | number) => {
      navigate(`/bundles/edit/${encodeURIComponent(id.toString() ?? '')}`);
    },
    [navigate],
  );

  return (
    <BundlePreview
      bundle={bundle}
      onSelect={handleView}
      onEdit={handleEditBundle}
      showFiles
      showInExplorerEnabled
    />
  );
}

export default BundleInfoPreview;
