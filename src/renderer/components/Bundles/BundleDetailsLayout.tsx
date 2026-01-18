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
import { Outlet, useBlocker, useLocation, useMatch, useNavigate } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';
import { QueryKeys } from 'renderer/scripts/utils';
import BundleEditor from './BundleEditor';
import BundleInfoPreview from './BundleInfoPreview';

/** Layout for the bundles details and editor */
function BundleDetailsLayout() {
  const previewRef = useRef<HTMLDivElement | null>(null);
  const bundleMatch = useMatch('/bundles/:mode/:bundleId');
  const tabParam = bundleMatch?.params.mode;
  const idParam = bundleMatch?.params.bundleId;

  const {
    data: bundle,
    isPending: isBundlePending,
    refetch: refetchBundle,
  } = useQuery({
    enabled: !!idParam,
    queryKey: [QueryKeys.bundles, idParam],
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
    navigate(`/bundles/${newTabId}/${encodeURIComponent(idParam ?? '')}`);
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
          {isBundlePending && <Spinner />}
          {!isBundlePending &&
            !!bundle &&
            (tabParam === 'edit' ? (
              <BundleEditor bundle={bundle} refetchBundle={refetchBundle} />
            ) : (
              <BundleInfoPreview bundle={bundle} />
            ))}
        </div>
      </div>
    </div>
  );
}

export default BundleDetailsLayout;
