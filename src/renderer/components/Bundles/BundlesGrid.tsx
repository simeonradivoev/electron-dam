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
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';
import Bundle from './Bundle';

const BundlesGrid = () => {
  const { setFileInfo, setSelected, projectDirectory } = useContext(AppContext);
  const { viewInExplorer } = useContext(AppContext);
  const [filter, setFilter] = useState('');
  const [selectedBundles, setSelectedBundles] = useState<string[]>([]);

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

  const handleSelect = (id: string | number, e?: React.MouseEvent) => {
    if (e?.ctrlKey || e?.metaKey) {
      setSelectedBundles((prev) => {
        if (prev.includes(id.toString())) {
          return prev.filter((i) => i !== id.toString());
        }
        return [...prev, id.toString()];
      });
    } else if (e?.shiftKey) {
      // Simple shift select implementation (range selection could be added later if needed)
      setSelectedBundles((prev) => {
        if (!prev.includes(id.toString())) {
          return [...prev, id.toString()];
        }
        return prev;
      });
    } else {
      // If clicking without modifiers, navigate as before, unless we are in selection mode?
      // The requirement says "add multi selection", usually this implies click selects, double click opens?
      // Or click navigates, and only ctrl+click selects?
      // The original code navigated on select.
      // Let's keep navigation on click if no modifier, but clear selection?
      // Or maybe we should change the behavior to: click selects, double click opens?
      // For now, let's assume modifier keys toggle selection, and simple click navigates (and maybe clears selection?)

      // Actually, usually in file explorers:
      // Click = Select (and clear others)
      // Ctrl+Click = Toggle Select
      // Double Click = Open

      // But the previous behavior was: Click = Navigate (Open)
      // So to preserve that, maybe we only select with modifiers?
      // Or we change the interaction model.

      // Let's try:
      // Click = Navigate (as before)
      // Ctrl/Shift + Click = Select (and don't navigate)

      navigate({
        pathname: `/bundles/${encodeURI(id.toString())}/info`,
      });
    }
  };

  const handleMassDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedBundles.length} bundles?`)) {
      return;
    }

    for (const id of selectedBundles) {
      await window.api.deleteBundle(id);
    }
    setSelectedBundles([]);
    bundles.refetch();
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
          {selectedBundles.length > 0 && (
             <Button
              onClick={handleMassDelete}
              title={`Delete ${selectedBundles.length} items`}
              minimal
              icon="trash"
              intent="danger"
            />
          )}
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
      <div
        className="grid y-scroll"
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setSelectedBundles([]);
          }
        }}
        role="button"
        tabIndex={0}
        onKeyDown={() => {}}
      >
        {bundles.data ? (
          bundles.data.map((b) => (
            <div
              key={b.id}
              onClick={(e) => {
                e.stopPropagation();
              }}
              style={{ display: 'contents' }}
              role="button"
              tabIndex={0}
              onKeyDown={() => {}}
            >
              <Bundle
                setFileInfo={setFileInfo}
                onSelect={handleSelect}
                bundle={b}
                handleRefresh={handleRefresh}
                allowDelete
                isSelected={selectedBundles.includes(b.id.toString())}
              />
            </div>
          ))
        ) : (
          <Spinner />
        )}
      </div>
    </div>
  );
};

export default BundlesGrid;
