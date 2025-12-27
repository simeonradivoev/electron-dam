import {
  Button,
  ButtonGroup,
  Classes,
  ControlGroup,
  Divider,
  FormGroup,
  Icon,
  InputGroup,
  Label,
  Navbar,
  NavbarGroup,
  Switch,
  Tab,
  TabId,
  Tabs,
  Tag,
  TagInput,
} from '@blueprintjs/core';
import { Tooltip2 } from '@blueprintjs/popover2';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useApp } from 'renderer/contexts/AppContext';
import { StoreSchemaZod } from 'shared/constants';

function handleGenerateMissingEmbeddings() {
  window.api.generateMissingEmbeddings();
}

function General() {
  const { darkMode, setDarkMode, setSelectedProjectDirectory, projectDirectory } = useApp();
  const { data: version } = useQuery({
    queryKey: ['version'],
    queryFn: () => window.api.getVersion(),
  });

  const directory = projectDirectory;
  return (
    <form className="settings-content">
      <FormGroup label="Application Information">
        <ButtonGroup className="b">
          <Tag icon="application" title="App Version">
            {version?.version}
          </Tag>
        </ButtonGroup>
      </FormGroup>

      <FormGroup label="Dark Mode">
        <Switch id="dark-mode" large checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
      </FormGroup>

      <FormGroup label="Project Directory">
        <ControlGroup id="project-dir">
          <InputGroup value={directory ?? 'No Project'} id="text-input" disabled />
          <Button
            icon="edit"
            onClick={async () =>
              setSelectedProjectDirectory(await window.api.selectProjectDirectory())
            }
          >
            Choose Project Directory
          </Button>
        </ControlGroup>
      </FormGroup>
      <FormGroup
        label={
          <>
            Generate Missing Embeddings{' '}
            <Icon
              className={Classes.TEXT_MUTED}
              title="Only files that have defined description can have embeddings generated."
              icon="info-sign"
            />
          </>
        }
        subLabel="This will generate searchable embeddings for all suitable files."
      >
        <ControlGroup>
          <Button icon="refresh" onClick={handleGenerateMissingEmbeddings}>
            Generate
          </Button>
        </ControlGroup>
      </FormGroup>
    </form>
  );
}

function Settings() {
  const [navbarTabId, setNavbarTabId] = useState<TabId>('general');
  return (
    <div className="settings">
      <Navbar className="settings-navbar">
        <NavbarGroup>
          <Tabs onChange={setNavbarTabId} selectedTabId={navbarTabId} large>
            <Tab icon="settings" id="general" title="General" />
            <Tab icon="bug" id="debug" title="Debug" />
          </Tabs>
        </NavbarGroup>
      </Navbar>
      <Tabs selectedTabId={navbarTabId} renderActiveTabPanelOnly>
        <Tab id="general" panel={<General />} />
      </Tabs>
    </div>
  );
}

export default Settings;
