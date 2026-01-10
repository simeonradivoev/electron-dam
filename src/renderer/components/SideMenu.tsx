import { Button, ButtonGroup, Spinner, SpinnerSize } from '@blueprintjs/core';
import { useIsFetching } from '@tanstack/react-query';
import cn from 'classnames';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useMatch, useBlocker } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';
import { useTasks } from 'renderer/contexts/TasksContext';
import { useLocalStorage } from 'usehooks-ts';

const searchQueryKey = 'search-query';
const searchPageKey = 'search-page';
const focusedBundleKey = 'focused-bundle-key';

function SideMenu() {
  const navigate = useNavigate();
  const { focusedItem } = useApp();
  const { tasks } = useTasks();
  const [searchQuery, setSearchQuery] = useLocalStorage<string | undefined>(
    searchQueryKey,
    undefined,
  );
  const [searchPage, setSearchPage] = useLocalStorage(searchPageKey, 0);
  const [focusedBundle, setFocusedBundle] = useLocalStorage<string | undefined>(
    focusedBundleKey,
    undefined,
  );
  const [settingsTab, setSettingsTab] = useState('general');
  const searchMatch = useMatch('search/:query/:page');
  const bundleMatch = useMatch('/bundles/:focusId/:mode');
  const settingsMatch = useMatch('/settings/:tab');
  const isBundles = useMatch('bundles/*');
  const isSettings = useMatch('settings/*');
  const isFetching = useIsFetching();
  const activeTasks = useMemo(
    () => tasks.filter((t) => t.status === 'PENDING' || t.status === 'RUNNING').length,
    [tasks],
  );

  useEffect(() => {
    if (searchMatch?.params.query) {
      setSearchQuery(searchMatch?.params.query);
    }
  }, [searchMatch, setSearchQuery]);

  useEffect(() => {
    if (searchMatch?.params.page) {
      setSearchPage(Number.parseInt(searchMatch?.params.page, 10));
    }
  }, [searchMatch, setSearchPage]);

  useEffect(() => {
    if (isBundles) {
      setFocusedBundle(bundleMatch?.params.focusId);
    }
  }, [bundleMatch?.params.focusId, isBundles, setFocusedBundle]);

  useEffect(() => {
    if (isSettings) {
      setSettingsTab(settingsMatch?.params.tab ?? 'general');
    }
  }, [isSettings, settingsMatch?.params.tab]);

  return (
    <ButtonGroup onFocus={() => {}} large vertical className="side-menu">
      <Button
        title="Home"
        variant="minimal"
        active={!!useMatch('')}
        onClick={() => {
          navigate('/');
        }}
        icon="home"
      />
      <Button
        title={focusedBundle ? `Bundle (${focusedBundle})` : `Bundles`}
        variant="minimal"
        active={!!isBundles}
        onClick={() => {
          navigate(
            focusedBundle ? `/bundles/${encodeURIComponent(focusedBundle)}/info` : '/bundles',
          );
        }}
        icon="projects"
      />
      <Button
        title={`Explorer (${focusedItem})`}
        variant="minimal"
        className={cn({ active: focusedItem })}
        active={!!useMatch('explorer/*')}
        onClick={() => {
          navigate({
            pathname: focusedItem ? `explorer/${encodeURIComponent(focusedItem)}` : 'explorer',
          });
        }}
        icon="folder-open"
      />
      <Button
        title="Tasks"
        variant="minimal"
        active={!!useMatch('tasks')}
        onClick={() => {
          navigate('/tasks');
        }}
        icon="inbox"
      />
      <Button
        title={`Search (${searchQuery})`}
        variant="minimal"
        active={!!useMatch('search/*')}
        onClick={() => {
          navigate(searchQuery ? `/search/${searchQuery}/${searchPage}` : '/search');
        }}
        icon="search"
      />
      <Button
        title={`Settings (${settingsTab})`}
        variant="minimal"
        active={!!isSettings}
        onClick={() => {
          navigate({ pathname: `/settings/${settingsTab}` });
        }}
        icon="cog"
      />
      {(isFetching > 0 || activeTasks > 0) && (
        <Spinner className="loading" size={SpinnerSize.SMALL} />
      )}
    </ButtonGroup>
  );
}

export default SideMenu;
