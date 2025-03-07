import {
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
import { BreadcrumbProps, Breadcrumbs2 } from '@blueprintjs/popover2';
import { useQuery, UseQueryResult } from '@tanstack/react-query';
import { useContext, useEffect, useRef } from 'react';
import { Outlet, useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';

export type BundleDetailsContextType = {
  bundle: UseQueryResult<BundleInfo | undefined, unknown>;
  viewInExplorer: (id: string | number) => void;
};

const BundleDetailsLayout = () => {
  const { viewInExplorer } = useContext(AppContext);
  const previewRef = useRef<HTMLDivElement | null>(null);
  const bundleMatch = useLocation();
  const params = bundleMatch.pathname.substring('/bundles/'.length);
  const tabParamIndex = params.lastIndexOf('/');
  const tabParam =
    tabParamIndex >= 0 ? params.substring(tabParamIndex + 1) : undefined;
  const idParam =
    tabParamIndex >= 0
      ? decodeURIComponent(params.substring(0, tabParamIndex))
      : undefined;

  const bundle = useQuery(
    ['bundle', idParam],
    async (queryKey) => window.api.getBundle(queryKey.queryKey[1]!),
    { enabled: !!idParam }
  );
  const navigate = useNavigate();

  const handleReturn = () => {
    navigate('/bundles');
  };

  const BREADCRUMBS: BreadcrumbProps[] = [
    { onClick: handleReturn, icon: 'projects', text: 'Bundles' },
    {
      icon: 'box',
      text: bundle.data ? bundle.data.name : <Spinner size={12} />,
    },
  ];

  const handleTabChange = (
    newTabId: TabId,
    prevTabId: TabId | undefined,
    event: React.MouseEvent<HTMLElement, MouseEvent>
  ) => {
    navigate(`/bundles/${idParam}/${newTabId}`);
  };

  useEffect(() => {
    previewRef.current?.scroll(
      0,
      Number.parseFloat(localStorage.getItem(`bundle-scroll-${idParam}`) ?? '0')
    );
  });

  const blocker = useBlocker(() => {
    if (previewRef.current) {
      localStorage.setItem(
        `bundle-scroll-${idParam}`,
        previewRef.current?.scrollTop.toString() ?? '0'
      );
    }

    return false;
  });

  return (
    <div className="bundle-details-layout">
      <Navbar>
        <NavbarGroup align="left">
          <NavbarHeading>
            <Breadcrumbs2 className="breadcrumbs" items={BREADCRUMBS} />
          </NavbarHeading>
        </NavbarGroup>
        <NavbarGroup align="right">
          <NavbarDivider />
          <Button minimal icon="menu" />
        </NavbarGroup>
      </Navbar>
      <div className="bundle-info">
        <Tabs selectedTabId={tabParam} onChange={handleTabChange}>
          <Tab id="info" title="Info" />
          <Tab id="edit" title="Edit" disabled={!bundle.data} />
        </Tabs>
        <div
          ref={previewRef}
          id="preview-bundle-tab-panel"
          className="y-scroll wide"
        >
          <Outlet context={{ bundle, viewInExplorer }} />
        </div>
      </div>
    </div>
  );
};

export default BundleDetailsLayout;
