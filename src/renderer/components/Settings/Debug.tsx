import { FormGroup, Switch } from '@blueprintjs/core';
import { useSessionStorage } from 'usehooks-ts';

export default function Debug() {
  const [queryDebugToolsVisible, setQueryDebugToolsVisible] = useSessionStorage(
    'queryDebugTools',
    false,
  );

  return (
    <FormGroup label="Query Debug Window">
      <Switch
        id="query-debug-window"
        large
        checked={queryDebugToolsVisible}
        onChange={(e) => setQueryDebugToolsVisible((e.target as HTMLInputElement).checked)}
      />
    </FormGroup>
  );
}
