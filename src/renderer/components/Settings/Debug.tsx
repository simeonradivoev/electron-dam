import {
  Button,
  ButtonGroup,
  Classes,
  ControlGroup,
  Divider,
  FormGroup,
  Icon,
  Switch,
} from '@blueprintjs/core';
import { useSessionStorage } from 'usehooks-ts';

export default function Debug() {
  const [queryDebugToolsVisible, setQueryDebugToolsVisible] = useSessionStorage(
    'queryDebugTools',
    false,
  );

  return (
    <>
      <FormGroup label="Query Debug Window">
        <Switch
          id="query-debug-window"
          large
          checked={queryDebugToolsVisible}
          onChange={(e) => setQueryDebugToolsVisible((e.target as HTMLInputElement).checked)}
        />
      </FormGroup>
      <FormGroup label="Shortcuts">
        <ButtonGroup>
          <Button onClick={() => window.api.openSystemPath('log')}>Log</Button>
          <Button onClick={() => window.api.openSystemPath('user')}>User Data</Button>
          <Button onClick={() => window.api.openSystemPath('project')}>Project</Button>
        </ButtonGroup>
      </FormGroup>

      <Divider />
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
          <Button icon="refresh" onClick={() => window.api.generateMissingEmbeddings()}>
            Generate
          </Button>
        </ControlGroup>
      </FormGroup>
    </>
  );
}
