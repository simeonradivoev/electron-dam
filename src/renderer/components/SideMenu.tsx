import { Button, ButtonGroup, Spinner, SpinnerSize } from '@blueprintjs/core';
import { useIsFetching } from '@tanstack/react-query';
import cn from 'classnames';
import { useEffect } from 'react';
import { useNavigate, useMatch } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';
import { useLocalStorage } from 'usehooks-ts';

const searchQueryKey = 'search-query';
const searchPageKey = 'search-page';
const focusedBundleKey = 'focused-bundle-key';

function SideMenu() {
  const navigate = useNavigate();
  const { focusedItem } = useApp();
  const [searchQuery, setSearchQuery] = useLocalStorage<string | undefined>(
    searchQueryKey,
    undefined,
  );
  const [searchPage, setSearchPage] = useLocalStorage(searchPageKey, 0);
  const [focusedBundle, setFocusedBundle] = useLocalStorage<string | undefined>(
    focusedBundleKey,
    undefined,
  );
  const searchMatch = useMatch('search/:query/:page');
  const bundleMatch = useMatch('/bundles/:focusId');
  const isFetching = useIsFetching();

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
    if (bundleMatch?.params.focusId) {
      setFocusedBundle(bundleMatch?.params.focusId);
    }
  }, [bundleMatch?.params.focusId, setFocusedBundle]);

  return (
    <ButtonGroup onFocus={() => {}} large vertical className="side-menu">
      <Button
        title="Home"
        minimal
        active={!!useMatch('')}
        onClick={() => {
          navigate('/');
        }}
        icon="home"
      />
      <Button
        title={focusedBundle ? `Bundle (${focusedBundle})` : `Bundles`}
        minimal
        active={!!useMatch('bundles/*')}
        onClick={() => {
          navigate(focusedBundle ? `/bundles/${focusedBundle}` : '/bundles');
        }}
        icon="projects"
      />
      <Button
        title={`Explorer (${focusedItem})`}
        minimal
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
        minimal
        active={!!useMatch('tasks')}
        onClick={() => {
          navigate('/tasks');
        }}
        icon="list"
      />
      <Button
        title={`Search (${searchQuery})`}
        minimal
        active={!!useMatch('search/*')}
        onClick={() => {
          navigate(searchQuery ? `/search/${searchQuery}/${searchPage}` : '/search');
        }}
        icon="search"
      />
      <Button
        title="Settings"
        minimal
        active={!!useMatch('settings')}
        onClick={() => {
          navigate({ pathname: `/settings` });
        }}
        icon="cog"
      />
      {isFetching > 0 && <Spinner className="loading" size={SpinnerSize.SMALL} />}
    </ButtonGroup>
  );
}

export default SideMenu;
