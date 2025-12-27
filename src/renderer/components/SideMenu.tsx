import { Button, ButtonGroup } from '@blueprintjs/core';
import cn from 'classnames';
import { useEffect } from 'react';
import { useNavigate, useMatch, useSearchParams } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';
import { useSavedState, useSavedStateRaw } from 'renderer/scripts/utils';

const searchQueryKey = 'search-query';
const searchPageKey = 'search-page';
const focusedBundleKey = 'focused-bundle-key';

function SideMenu() {
  const navigate = useNavigate();
  const { focusedItem } = useApp();
  const [searchQuery, setSearchQuery] = useSavedStateRaw(searchQueryKey);
  const [searchPage, setSearchPage] = useSavedState<number>(searchPageKey, 0);
  const [focusedBundle, setFocusedBundle] = useSavedStateRaw(focusedBundleKey);
  const searchMatch = useMatch('search/:query/:page');
  const bundleMatch = useMatch('/bundles/:focusId');

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
    </ButtonGroup>
  );
}

export default SideMenu;
