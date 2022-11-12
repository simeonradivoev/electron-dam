import { Divider, Spinner, Tab, TabId, Tabs } from '@blueprintjs/core';
import { BreadcrumbProps, Breadcrumbs2 } from '@blueprintjs/popover2';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { Outlet, useMatch, useNavigate } from 'react-router-dom';

export type BundleInfoContextType = {
  fileInfo: UseQueryResult<FileInfo | null, unknown>;
};

const BundleInfo = () => {
  const bundleMatch = useMatch('/bundles/:file/:tab');
  const fileInfo = useQuery(
    ['fileInfo', bundleMatch?.params.file],
    async (queryKey) => window.api.getFileDetails(queryKey.queryKey[1]!),
    { enabled: !!bundleMatch?.params.file }
  );
  const navigate = useNavigate();

  const handleReturn = () => {
    navigate('/bundles');
  };

  const BREADCRUMBS: BreadcrumbProps[] = [
    { onClick: handleReturn, icon: 'projects', text: 'Bundles' },
    {
      icon: 'box',
      text: fileInfo.data ? fileInfo.data.name : <Spinner size={12} />,
    },
  ];

  const handleTabChange = (
    newTabId: TabId,
    prevTabId: TabId | undefined,
    event: React.MouseEvent<HTMLElement, MouseEvent>
  ) => {
    navigate(`/bundles/${bundleMatch?.params.file}/${newTabId}`);
  };

  return (
    <div className="bundle-info">
      <Breadcrumbs2 className="breadcrumbs" items={BREADCRUMBS} />
      <Divider />
      <Tabs selectedTabId={bundleMatch?.params.tab} onChange={handleTabChange}>
        <Tab id="info" title="Info" />
        <Tab id="edit" title="Edit" disabled={!fileInfo.data} />
      </Tabs>
      <div id="preview-bundle-tab-panel" className="y-scroll wide">
        <Outlet context={{ fileInfo } as BundleInfoContextType} />
      </div>
    </div>
  );
};

export default BundleInfo;
