import { Divider, Tab, TabId, Tabs } from '@blueprintjs/core';
import { useState } from 'react';
import Debug from './Debug';
import General from './General';
import Metadata from './Metadata';

function Settings() {
  const [navbarTabId, setNavbarTabId] = useState<TabId>('general');
  return (
    <div className="settings">
      <Tabs vertical onChange={setNavbarTabId} selectedTabId={navbarTabId} large>
        <Tab icon="settings" id="general" title="General" />
        <Tab icon="search-template" id="metadata" title="Metadata" />
        <Tab icon="bug" id="debug" title="Debug" />
      </Tabs>
      <Divider />
      <Tabs className="settings-content-tabs" selectedTabId={navbarTabId} renderActiveTabPanelOnly>
        <Tab className="settings-content" id="general" panel={<General />} />
        <Tab className="settings-content" id="metadata" panel={<Metadata />} />
        <Tab className="settings-content" id="debug" panel={<Debug />} />
      </Tabs>
    </div>
  );
}

export default Settings;
