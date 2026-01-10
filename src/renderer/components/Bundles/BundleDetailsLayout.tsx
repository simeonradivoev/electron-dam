import {
  BreadcrumbProps,
  Breadcrumbs,
  Button,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  NavbarHeading,
  Spinner,
  Tab,
  TabId,
  Tabs,
} from '@blueprintjs/core';
import { QueryObserverResult, useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Outlet, useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';

export type BundleDetailsContextType = {
  bundle: BundleInfo;
  viewInExplorer: (id: string | number) => void;
  refetchBundle: () => Promise<QueryObserverResult<BundleInfo | null, Error>>;
};

/** Layout for the bundles details and editor */
function BundleDetailsLayout() {
  const { viewInExplorer } = useApp();
  const previewRef = useRef<HTMLDivElement | null>(null);
  const bundleMatch = useLocation();
  const params = bundleMatch.pathname.substring('/bundles/'.length);
  const tabParamIndex = params.lastIndexOf('/');
  const tabParam = tabParamIndex >= 0 ? params.substring(tabParamIndex + 1) : undefined;
  const idParam =
    tabParamIndex >= 0 ? decodeURIComponent(params.substring(0, tabParamIndex)) : undefined;

  const {
    data: bundle,
    isPending: isBundlePending,
    refetch: refetchBundle,
  } = useQuery({
    enabled: !!idParam,
    queryKey: ['bundle', idParam],
    queryFn: () => window.api.getBundle(idParam!),
  });
  const navigate = useNavigate();

  const handleReturn = () => {
    navigate('/bundles');
  };

  const BREADCRUMBS: BreadcrumbProps[] = [
    { onClick: handleReturn, icon: 'projects', text: 'Bundles' },
    {
      icon: 'box',
      text: isBundlePending ? <Spinner size={12} /> : bundle?.name,
    },
  ];

  const handleTabChange = (
    newTabId: TabId,
    prevTabId: TabId | undefined,
    event: React.MouseEvent<HTMLElement, MouseEvent>,
  ) => {
    navigate(`/bundles/${encodeURIComponent(idParam ?? '')}/${newTabId}`);
  };

  return (
    <div className="bundle-details-layout">
      <Navbar>
        <NavbarGroup align="left">
          <NavbarHeading>
            <Breadcrumbs className="breadcrumbs" items={BREADCRUMBS} />
          </NavbarHeading>
        </NavbarGroup>
        <NavbarGroup align="right">
          <NavbarDivider />
          <Button variant="minimal" icon="menu" />
        </NavbarGroup>
      </Navbar>
      <div className="bundle-info">
        <Tabs selectedTabId={tabParam} onChange={handleTabChange}>
          <Tab id="info" title="Info" />
          <Tab id="edit" title="Edit" disabled={!bundle} />
        </Tabs>
        <div ref={previewRef} id="preview-bundle-tab-panel">
          {isBundlePending ? (
            <Spinner />
          ) : (
            bundle && <Outlet context={{ bundle, refetchBundle, viewInExplorer }} />
          )}
        </div>
      </div>
    </div>
  );
}

export default BundleDetailsLayout;
