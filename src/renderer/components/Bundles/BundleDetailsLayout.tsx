import {
  Button,
  Divider,
  InputGroup,
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
import { useState } from 'react';
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router-dom';

export type BundleDetailsContextType = {
  bundle: UseQueryResult<BundleInfo | undefined, unknown>;
};

const BundleDetailsLayout = () => {
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
        <div id="preview-bundle-tab-panel" className="y-scroll wide">
          <Outlet context={{ bundle } as BundleDetailsContextType} />
        </div>
      </div>
    </div>
  );
};

export default BundleDetailsLayout;
