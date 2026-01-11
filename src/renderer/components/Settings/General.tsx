import {
  Button,
  ButtonGroup,
  ControlGroup,
  Divider,
  FormGroup,
  IconSize,
  InputGroup,
  Spinner,
  Tag,
  Tooltip,
} from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import { useApp } from 'renderer/contexts/AppContext';
import { humanFileSize } from 'renderer/scripts/utils';
import { getOption, OptionCategory, Options } from 'shared/constants';
import { useSettings } from './Form';

export default function General() {
  const { setSelectedProjectDirectory, projectDirectory } = useApp();
  const { data: version } = useQuery({
    queryKey: ['version'],
    queryFn: () => window.api.getVersion(),
  });

  const cacheSize = useQuery({
    queryKey: ['cacheSize'],
    queryFn: () => window.api.getCacheSize(),
  });

  const { form, data, isFetching, instantSubmit } = useSettings(OptionCategory.General);

  const directory = projectDirectory;
  return (
    <>
      <FormGroup label="Application Information">
        <ButtonGroup className="app-info">
          <Tooltip position="bottom" content="App Version">
            <Tag icon="application">{version?.version}</Tag>
          </Tooltip>
          <Tooltip position="bottom" content="Cache Size">
            <Tag icon="outdated">
              {cacheSize.isFetching ? (
                <Spinner size={IconSize.STANDARD} />
              ) : (
                !!cacheSize.data && humanFileSize(cacheSize.data)
              )}
            </Tag>
          </Tooltip>
        </ButtonGroup>
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
      <Divider />
      <form.AppForm>
        <form.OptionsForm isFetching={isFetching}>
          {Object.keys(Options)
            .map((key) => ({ key, option: getOption(key) }))
            .filter(({ option }) => option.category === OptionCategory.General)
            .map(({ key }) => (
              <form.AppField
                key={key}
                // eslint-disable-next-line react/no-children-prop
                children={(field) => (
                  <field.Option
                    instantSubmit={instantSubmit}
                    defaultValue={data?.[key]}
                    isFetching={isFetching}
                  />
                )}
                name={key}
              />
            ))}
        </form.OptionsForm>
      </form.AppForm>
    </>
  );
}
