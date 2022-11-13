import {
  Button,
  InputGroup,
  Navbar,
  NavbarDivider,
  NavbarGroup,
  Spinner,
} from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';

import { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';
import Bundle from './Bundle';

const BundlesGrid = () => {
  const { setFileInfo, setSelected, projectDirectory } = useContext(AppContext);
  const [filter, setFilter] = useState('');
  const bundles = useQuery<BundleInfo[]>(
    ['bundles', projectDirectory],
    async ({ queryKey }) => {
      return window.api.getBundles();
    },
    {
      enabled: !!projectDirectory?.data,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
    }
  );
  const navigate = useNavigate();

  const handleSelect = (id: string | number) => {
    navigate({
      pathname: `/bundles/${id}/info`,
    });
  };

  const handleNew = () => {
    navigate({
      pathname: `/bundles/new`,
    });
  };

  const handleRefresh = () => {
    bundles.refetch();
  };

  function handleSearchSubmit(e: any) {
    e.preventDefault();
    setFilter(e.target.value);
  }

  return (
    <div className="bundles-grid">
      <Navbar>
        <NavbarGroup align="left">
          <Button
            onClick={handleNew}
            title="Create New Virtual Bundle"
            minimal
            icon="add"
          />
        </NavbarGroup>
        <NavbarGroup align="right">
          <InputGroup
            inputRef={(element) => {
              ((element ?? {}) as any).onsearch = handleSearchSubmit;
            }}
            name="search"
            fill
            className="search"
            leftIcon="search"
            placeholder="Search"
            type="search"
            defaultValue={filter}
          />
          <Button
            disabled={bundles.isFetching}
            onClick={handleRefresh}
            minimal
            icon="refresh"
          />
          <NavbarDivider />
          <Button minimal icon="menu" rightIcon="caret-down" />
        </NavbarGroup>
      </Navbar>
      <div className="grid y-scroll">
        {bundles.data ? (
          bundles.data.map((b) => (
            <Bundle
              setFileInfo={setFileInfo}
              onSelect={handleSelect}
              bundle={b}
              key={b.id}
            />
          ))
        ) : (
          <Spinner />
        )}
      </div>
    </div>
  );
};

export default BundlesGrid;
