import { Switch } from '@blueprintjs/core';
import React, { useContext } from 'react';
import { AppContext } from 'renderer/AppContext';

const Settings = () => {
  const { darkMode, setDarkMode } = useContext(AppContext);
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
