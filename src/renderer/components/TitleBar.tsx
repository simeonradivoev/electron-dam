import { Button, Classes } from '@blueprintjs/core';
import { useLocation } from 'react-router-dom';
import icon from '../../../assets/icon.png';

function TitleBar() {
  const location = useLocation();

  return (
    <div className="titlebar">
      {/* Left side */}
      <div className="left">
        <img src={icon} className="icon" />
        <span className="titlebar-title">{document.title}</span>
      </div>

      <div className={Classes.TEXT_MUTED}>{location.pathname}</div>

      {/* Right side */}
      <div className="controls">
        <Button minimal icon="minus" onClick={() => window.api.minimizeWindow()} />
        <Button minimal icon="maximize" onClick={() => window.api.maximizeWindow()} />
        <Button minimal id="close" icon="cross" onClick={() => window.close()} />
      </div>
    </div>
  );
}

export default TitleBar;
