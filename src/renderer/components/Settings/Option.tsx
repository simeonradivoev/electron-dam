import {
  Classes,
  ControlGroup,
  FormGroup,
  HTMLSelect,
  Icon,
  InputGroup,
  Menu,
  NumericInput,
  Switch,
  Tag,
  Tooltip,
  showContextMenu,
  MenuItem,
} from '@blueprintjs/core';
import { useQueryClient } from '@tanstack/react-query';
import cn from 'classnames';
import { useCallback } from 'react';
import { OptionType, Options } from '../../../shared/constants';
import { useFieldContext } from './Form';

interface Props {
  isFetching?: boolean;
  defaultValue: unknown;
  instantSubmit?: (key: string, value: string | number | boolean) => void;
}

export default function Option({ isFetching, defaultValue, instantSubmit }: Props) {
  const queryClient = useQueryClient();
  const field = useFieldContext<string | number | boolean>();
  const option = Options[field.name as keyof typeof Options] as OptionType;
  const optionDefault = option.default ? option.default : option.schema.safeParse(undefined).data;

  const warning =
    field.state.meta.errors.length > 0 ? (
      <Tooltip
        intent="danger"
        content={
          <ul className={Classes.LIST_UNSTYLED}>
            {field.state.meta.errors.map((e: Error) => (
              <li>{e.message}</li>
            ))}
          </ul>
        }
      >
        <Tag minimal intent="danger" icon="error" />
      </Tooltip>
    ) : undefined;

  const handleChange = useCallback(
    (value: string | number | boolean) => {
      if (instantSubmit && option.instant === true) {
        instantSubmit(field.name, value);
      } else {
        field.handleChange(value);
      }
    },
    [field, instantSubmit, option.instant],
  );

  const label = (
    <div
      onContextMenu={
        optionDefault !== defaultValue
          ? (e) =>
              showContextMenu({
                content: (
                  <Menu>
                    <MenuItem
                      icon="reset"
                      text="Reset"
                      onClick={() => {
                        window.api.setSetting(field.name as keyof typeof Options, optionDefault);
                        queryClient.refetchQueries({ queryKey: ['options'] });
                      }}
                    />
                  </Menu>
                ),
                targetOffset: { top: e.clientY, left: e.clientX },
              })
          : undefined
      }
    >
      {option.description && (
        <Icon
          size={14}
          title={option.description}
          className={cn(Classes.TEXT_MUTED, Classes.MINIMAL)}
          icon="info-sign"
        />
      )}{' '}
      {option.label}
      {optionDefault !== defaultValue && (
        <Icon intent="primary" title={`Default value (${optionDefault})`} icon="dot" />
      )}
    </div>
  );
  const { subLabel } = option;
  const labelClass = cn('setting-group', {
    changed: optionDefault !== defaultValue,
  });

  let control: JSX.Element | undefined;
  if (option.type === 'string') {
    control = (
      <FormGroup label={label} subLabel={subLabel} className={labelClass}>
        <ControlGroup>
          <InputGroup
            fill
            asyncControl
            id={field.name}
            rightElement={warning}
            intent={field.state.meta.errors.length > 0 ? 'danger' : 'none'}
            inputClassName={cn({
              changed: !field.state.meta.isDefaultValue,
              [Classes.SKELETON]: isFetching,
            })}
            value={(field.state.value as string) || ''}
            placeholder={option.hintValue}
            onBlur={field.handleBlur}
            onChange={(e) => handleChange(e.target.value)}
          />
        </ControlGroup>
      </FormGroup>
    );
  } else if (option.type === 'number') {
    control = (
      <FormGroup label={label} subLabel={subLabel} className={labelClass}>
        <ControlGroup>
          <NumericInput
            fill
            asyncControl
            id={field.name}
            rightElement={warning}
            intent={field.state.meta.errors.length > 0 ? 'danger' : 'none'}
            inputClassName={cn({
              changed: !field.state.meta.isDefaultValue,
              [Classes.SKELETON]: isFetching,
            })}
            value={field.state.value as number | string}
            placeholder={option.hintValue}
            onBlur={field.handleBlur}
            min={option.min}
            max={option.max}
            stepSize={option.stepSize}
            onValueChange={handleChange}
          />
        </ControlGroup>
      </FormGroup>
    );
  } else if (option.type === 'bool') {
    control = (
      <FormGroup label={label} className={labelClass}>
        <Switch
          size="large"
          id={field.name}
          label={subLabel}
          className={cn({
            changed: !field.state.meta.isDefaultValue,
            [Classes.SKELETON]: isFetching,
          })}
          checked={!!field.state.value}
          placeholder={option.hintValue}
          onBlur={field.handleBlur}
          onChange={(v) => handleChange((v.target as HTMLInputElement).checked)}
        />
      </FormGroup>
    );
  } else if (option.type === 'enum') {
    control = (
      <FormGroup label={label} className={labelClass}>
        <HTMLSelect
          options={option.options}
          className={cn({
            changed: !field.state.meta.isDefaultValue,
            [Classes.SKELETON]: isFetching,
          })}
          value={field.state.value as string | number}
          onChange={(e) => handleChange(e.target.value)}
        />
      </FormGroup>
    );
  }

  return control;
}
