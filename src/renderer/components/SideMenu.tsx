import { Button, ButtonGroup } from '@blueprintjs/core';
import cn from 'classnames';
import { useNavigate, useMatch } from 'react-router-dom';
import { useApp } from 'renderer/contexts/AppContext';

function SideMenu() {
  const navigate = useNavigate();
  const { focusedItem } = useApp();

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
        title="Bundles"
        minimal
        active={!!useMatch('bundles/*')}
        onClick={() => {
          navigate('/bundles');
        }}
        icon="projects"
      />
      <Button
        title="Explorer"
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
        title="Search"
        minimal
        active={!!useMatch('search')}
        onClick={() => {
          navigate('/search');
        }}
        icon="search"
      />
      <Button
        title="Settings"
        minimal
        active={!!useMatch('settings')}
        onClick={() => {
          navigate('/settings');
        }}
        icon="cog"
      />
    </ButtonGroup>
  );
}

export default SideMenu;
