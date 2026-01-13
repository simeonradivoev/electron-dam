import { Divider, Tab, Tabs } from '@blueprintjs/core';
import { useMatch, useNavigate } from 'react-router-dom';
import About from './About';
import Debug from './Debug';
import General from './General';
import Metadata from './Metadata';

function Settings() {
  const navigate = useNavigate();
  const tabMatch = useMatch('/settings/:tab');

  return (
    <div className="settings">
      <Tabs
        vertical
        onChange={(tab) => navigate(`/settings/${tab}`)}
        selectedTabId={tabMatch?.params.tab}
        size="large"
      >
        <Tab icon="settings" id="general" title="General" />
        <Tab icon="search-template" id="metadata" title="Metadata" />
        <Tab icon="bug" id="debug" title="Debug" />
        <Tab icon="help" id="help" title="Help" />
        <Tab icon="info-sign" id="about" title="About" />
      </Tabs>
      <Divider />
      <Tabs
        className="settings-content-tabs"
        selectedTabId={tabMatch?.params.tab}
        renderActiveTabPanelOnly
      >
        <Tab className="settings-content" id="general" panel={<General />} />
        <Tab className="settings-content" id="metadata" panel={<Metadata />} />
        <Tab className="settings-content" id="debug" panel={<Debug />} />
        <Tab className="settings-content" id="help" />
        <Tab className="settings-content" id="about" panel={<About />} />
      </Tabs>
    </div>
  );
}

export default Settings;
