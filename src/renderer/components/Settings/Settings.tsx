import { Switch } from '@blueprintjs/core';
import React from 'react';

type Props = {
  darkMode: boolean;
  setDarkMode: (darkMode: boolean) => void;
};

const Settings = ({ darkMode, setDarkMode }: Props) => {
  return (
    <div>
      <form>
        <Switch
          checked={darkMode}
          onChange={() => setDarkMode(!darkMode)}
          label="Dark Mode"
        />
      </form>
    </div>
  );
};

export default Settings;
