import { createFormHook, createFormHookContexts } from '@tanstack/react-form';
import { useQuery } from '@tanstack/react-query';
import log from 'electron-log/renderer';
import { useMemo } from 'react';
import { BuildOptionValidators, getOption, OptionCategory, Options } from 'shared/constants';
import { z } from 'zod/v3';
import Option from './Option';
import OptionsForm from './OptionsForm';

// export useFieldContext for use in your custom components
export const { fieldContext, formContext, useFieldContext, useFormContext } =
  createFormHookContexts();

export const {
  useAppForm: useSettingsForm,
  withForm,
  withFieldGroup,
} = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Option,
  },
  formComponents: {
    OptionsForm,
  },
});

type FormMeta = object;

export function safeParse(key: string, storage: Storage) {
  try {
    const data = storage.getItem(key);
    if (!data) {
      return undefined;
    }
    return JSON.parse(data);
  } catch {
    return undefined;
  }
}

export function useSettings(category: OptionCategory) {
  const { data, isFetching, refetch } = useQuery({
    queryKey: ['options', category],
    queryFn: async () =>
      window.api
        .getSettings(category)
        .then((d) => {
          const localData = Object.fromEntries(
            Object.keys(Options)
              .map((key) => ({ key, option: getOption(key) }))
              .filter(({ option }) => option.localType)
              .map(({ key, option }) => [
                key,
                option.localType === 'local'
                  ? option.schema.parse(safeParse(key, localStorage))
                  : option.schema.parse(safeParse(key, sessionStorage)),
              ]),
          );
          return {
            ...localData,
            ...d,
          } as { [key: string]: string | boolean | number | null | undefined };
        })
        .catch((e) => log.error(e)),
  });

  const validators = useMemo(() => BuildOptionValidators(category, true), [category]);

  const defaultMeta: FormMeta = {};

  const form = useSettingsForm({
    defaultValues: data,
    validators: { onChangeAsync: z.object(validators) },
    onSubmitMeta: defaultMeta,
    onSubmit: async ({ value }) => {
      if (!value) return Promise.reject(new Error('No Default Values Loaded'));
      // Save locals
      Object.keys(value)
        .map((key) => ({ key, v: value[key], option: getOption(key) }))
        .filter(({ key, v, option }) => !!option.localType && data?.[key] !== v)
        .forEach(({ key, v, option }) => {
          if (option.localType === 'local')
            localStorage.setItem(key, JSON.stringify(option.schema.parse(v)));
          else sessionStorage.setItem(key, JSON.stringify(option.schema.parse(v)));
          window.dispatchEvent(
            new StorageEvent('storage', { key, newValue: JSON.stringify(option.schema.parse(v)) }),
          );
        });
      // Save remote
      await window.api.setSettings(
        Object.fromEntries(
          Object.keys(value)
            .filter((key) => !getOption(key).localType)
            .map((key) => ({ key, v: value[key] }))
            .filter(({ key, v }) => data?.[key] !== v)
            .map(({ key, v }) => [key as keyof typeof Options, v]),
        ),
      );
      refetch();
      form.reset();
      return true;
    },
  });

  const instantSubmit = (key: string, value: string | number | boolean | null | undefined) => {
    const option = getOption(key);
    if (option && option.localType) {
      if (option.localType === 'local')
        localStorage.setItem(key, JSON.stringify(option.schema.parse(value)));
      else sessionStorage.setItem(key, JSON.stringify(option.schema.parse(value)));
      window.dispatchEvent(
        new StorageEvent('storage', { key, newValue: JSON.stringify(option.schema.parse(value)) }),
      );
      if (data) {
        data[key] = value;
      }
      form.setFieldValue(key, value);
    }
  };

  return { form, data, isFetching, refetch, instantSubmit };
}
