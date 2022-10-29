import React from 'react';
import FramelessTitleBar from 'frameless-titlebar';
import { UseQueryResult } from '@tanstack/react-query';
import { TitleBarTheme } from 'frameless-titlebar/dist/title-bar/typings';
import { Button, ButtonGroup, MenuItem } from '@blueprintjs/core';
import icon from '../../../assets/icon.png';

type Props = {
  projectDirectory: UseQueryResult<string | null, unknown>;
  setSelectedProjectDirectory: (directory: string | null) => void;
};

const TitleBar = ({ projectDirectory, setSelectedProjectDirectory }: Props) => {
  return (
    <FramelessTitleBar
      iconSrc={icon}
      title={projectDirectory.data ?? 'No Project Selected'}
      theme={{ bar: { borderBottom: '' } } as TitleBarTheme}
      menu={[
        {
          label: 'File',
          submenu: [
            {
              label: 'Open Project',
              click: async () => {
                setSelectedProjectDirectory(
                  await window.api.selectProjectDirectory()
                );
              },
            },
            {
              label: 'Quit',
              click: () => {
                window.close();
              },
            },
          ],
        },
      ]}
      onClose={() => window.close()}
      onMinimize={() => window.api.minimizeWindow()}
      onMaximize={() => window.api.maximizeWindow()}
    />
  );
};

export default TitleBar;
