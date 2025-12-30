/* eslint-disable react/no-children-prop */
import { Button, Classes, ControlGroup, Divider, FormGroup, Icon } from '@blueprintjs/core';
import z from 'zod/v3';
import { OptionCategory, Options, OptionType } from '../../../shared/constants';
import { useSettings } from './Form';

export default function Metadata() {
  const { form, data, isFetching } = useSettings(OptionCategory.Metadata);

  return (
    <div>
      <form.AppForm>
        <form.OptionsForm isFetching={isFetching}>
          {Object.keys(Options)
            .filter(
              (o) =>
                (Options[o as keyof typeof Options] as OptionType).category ===
                OptionCategory.Metadata,
            )
            .map((o) => (
              <form.AppField
                key={o}
                children={(field) => (
                  <field.Option defaultValue={data?.[o]} isFetching={isFetching} />
                )}
                name={o as any}
              />
            ))}
        </form.OptionsForm>
      </form.AppForm>
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
    </div>
  );
}
