import { Button, ButtonGroup } from '@blueprintjs/core';
import React from 'react';
import { useNavigate, useMatch } from 'react-router-dom';

type Props = {};

const SideMenu = ({}: Props) => {
  const navigate = useNavigate();

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
        active={!!useMatch('bundles')}
        onClick={() => {
          navigate('/bundles');
        }}
        icon="projects"
      />
      <Button
        title="Explorer"
        minimal
        active={!!useMatch('explorer')}
        onClick={() => {
          navigate({ pathname: 'explorer', search: '?' });
        }}
        icon="folder-open"
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
};

export default SideMenu;
