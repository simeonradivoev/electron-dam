import {
  Button,
  ButtonGroup,
  Collapse,
  ControlGroup,
  Divider,
  FormGroup,
  IconSize,
  InputGroup,
  Spinner,
  Tag,
  Tooltip,
} from '@blueprintjs/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import Markdown from 'react-markdown';
import rehypeExternalLinks from 'rehype-external-links';
import rehypeRaw from 'rehype-raw';
import { useApp } from 'renderer/contexts/AppContext';
import { humanFileSize } from 'renderer/scripts/utils';
import { getOption, OptionCategory, Options } from 'shared/constants';
import { string } from 'zod/v3';
import { useSettings } from './Form';

export default function General() {
  const { setSelectedProjectDirectory, projectDirectory } = useApp();
  const [showVersionChangelog, setShowVersionChangelog] = useState(false);
  const { data: version } = useQuery({
    queryKey: ['version'],
    queryFn: () => window.api.getVersion(),
  });

  const cacheSize = useQuery({
    queryKey: ['cacheSize'],
    queryFn: () => window.api.getCacheSize(),
  });

  const versionInfo = useQuery({
    queryKey: ['updates'],
    queryFn: () => window.api.getHasUpdate(),
  });

  const updateAndRestartMutation = useMutation({
    mutationKey: ['update'],
    mutationFn: () => window.api.updateAndRestart(),
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
          {versionInfo.isSuccess && (
            <ButtonGroup>
              <Tooltip
                position="bottom"
                content={
                  versionInfo.data?.isUpdateAvailable
                    ? `New Version ${versionInfo.data.info.version}`
                    : `Remote Version: ${versionInfo.data?.info.version}`
                }
              >
                <Button
                  size="small"
                  intent={versionInfo.data?.isUpdateAvailable ? 'warning' : 'none'}
                  icon={versionInfo.data?.isUpdateAvailable ? 'automatic-updates' : 'updated'}
                  endIcon={versionInfo.data?.isUpdateAvailable && 'caret-down'}
                  onClick={() => setShowVersionChangelog(!showVersionChangelog)}
                >
                  {versionInfo.data?.info.version}
                </Button>
              </Tooltip>
              {versionInfo.data?.isUpdateAvailable && (
                <Tooltip position="bottom" content="The App Will Restart">
                  <Button
                    disabled={updateAndRestartMutation.isPending}
                    onClick={() => updateAndRestartMutation.mutate()}
                    intent="primary"
                    icon="updated"
                    size="small"
                  >
                    Update
                  </Button>
                </Tooltip>
              )}
            </ButtonGroup>
          )}
          {versionInfo.isError && (
            <Tooltip position="bottom" content={versionInfo.error.message}>
              <Tag intent="warning" icon="automatic-updates">
                error
              </Tag>
            </Tooltip>
          )}
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
      <Collapse isOpen={!!versionInfo.data?.info.releaseNotes && showVersionChangelog}>
        {!!versionInfo.data && (
          <div className="change-log">
            {(versionInfo.data?.info.releaseNotes as []).map(
              (value: { version: string; note: string }) => (
                <>
                  <Markdown
                    rehypePlugins={[rehypeRaw, [rehypeExternalLinks, { target: '_blank' }]]}
                  >
                    {value.note}
                  </Markdown>
                  <Divider />
                </>
              ),
            )}
          </div>
        )}
      </Collapse>
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
