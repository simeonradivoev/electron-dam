import { Classes, Divider, Spinner, Tag } from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { humanFileSize } from 'renderer/scripts/utils';
import FolderFileGrid from '../FileInfoPanel/FolderFileGrid';
import { BundleDetailsContextType } from './BundleDetailsLayout';
import BundlePreview from './BundlePreviewBase';

/**
 * This is the bundle preview that is shown in the bundles tab not in the explorer
 */
function BundleInfoPreview() {
  const { bundle, viewInExplorer } = useOutletContext<BundleDetailsContextType>();
  const navigate = useNavigate();

  const handleView = useCallback(() => {
    viewInExplorer(bundle.id);
  }, [bundle, viewInExplorer]);

  const handleEditBundle = useCallback(
    (id: string | number) => {
      navigate(`/bundles/${encodeURI(id.toString() ?? '')}/edit`);
    },
    [navigate],
  );

  return (
    <BundlePreview
      bundle={bundle ?? null}
      onSelect={handleView}
      onEdit={handleEditBundle}
      showFiles
      showInExplorerEnabled
    />
  );
}

export default BundleInfoPreview;
