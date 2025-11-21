import {
  Button,
  ControlGroup,
  FormGroup,
  InputGroup,
  Label,
  Switch,
  Text,
} from '@blueprintjs/core';
import React, { useContext } from 'react';
import { AppContext } from 'renderer/AppContext';

const Settings = () => {
  const {
    darkMode,
    setDarkMode,
    setSelectedProjectDirectory,
    projectDirectory,
  } = useContext(AppContext);

  const directory = projectDirectory?.data;
  return (
    <div>
      <form>
        <FormGroup inline>
          <Switch
            alignIndicator="right"
            label="Dark Mode"
            large
            checked={darkMode}
            onChange={() => setDarkMode(!darkMode)}
          />

          <ControlGroup>
            <Label> Project Directory</Label>
            <InputGroup
              value={directory ?? 'No Project'}
              id="text-input"
              disabled
            />

            <Button
              icon="edit"
              onClick={async () =>
                setSelectedProjectDirectory(
                  await window.api.selectProjectDirectory()
                )
              }
            >
              Choose Project Directory
            </Button>
          </ControlGroup>
        </FormGroup>
      </form>
    </div>
  );
};

export default Settings;
