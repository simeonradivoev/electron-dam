import {
  Button,
  ButtonGroup,
  ControlGroup,
  Divider,
  FormGroup,
  InputGroup,
  Switch,
  Tag,
} from '@blueprintjs/core';
import { useQuery } from '@tanstack/react-query';
import { useApp } from 'renderer/contexts/AppContext';
import { getOption, OptionCategory, Options } from 'shared/constants';
import { useSettings } from './Form';

export default function General() {
  const { setSelectedProjectDirectory, projectDirectory } = useApp();
  const { data: version } = useQuery({
    queryKey: ['version'],
    queryFn: () => window.api.getVersion(),
  });

  const { form, data, isFetching, instantSubmit } = useSettings(OptionCategory.General);

  const directory = projectDirectory;
  return (
    <>
      <form>
        <FormGroup label="Application Information">
          <ButtonGroup className="b">
            <Tag icon="application" title="App Version">
              {version?.version}
            </Tag>
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
      </form>
      <Divider />
      <form.AppForm>
        <form.OptionsForm isFetching={isFetching}>
          {Object.keys(Options)
            .map((key) => ({ key, option: getOption(key) }))
            .filter(({ option }) => option.category === OptionCategory.General)
            .map(({ key }) => (
              <form.AppField
                key={key}
                children={(field) => (
                  <field.Option
                    instantSubmit={instantSubmit}
                    defaultValue={data?.[key]}
                    isFetching={isFetching}
                  />
                )}
                name={key as any}
              />
            ))}
        </form.OptionsForm>
      </form.AppForm>
    </>
  );
}
