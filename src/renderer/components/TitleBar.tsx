import FramelessTitleBar from 'frameless-titlebar';
import { TitleBarTheme } from 'frameless-titlebar/dist/title-bar/typings';
import { useLocation } from 'react-router-dom';
import icon from '../../../assets/icon.png';

type Props = {
  setSelectedProjectDirectory: (directory: string | null) => void;
};

function TitleBar({ setSelectedProjectDirectory }: Props) {
  const location = useLocation();

  return (
    <FramelessTitleBar
      iconSrc={icon}
      title={location.pathname}
      theme={{ bar: { borderBottom: '' } } as TitleBarTheme}
      menu={[
        {
          label: 'File',
          submenu: [
            {
              label: 'Open Project',
              click: async () => {
                setSelectedProjectDirectory(await window.api.selectProjectDirectory());
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
}

export default TitleBar;
