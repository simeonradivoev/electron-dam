/* eslint-disable react/no-children-prop */
import { Alert, Button, ButtonGroup, Classes, Icon, Tag } from '@blueprintjs/core';
import { Tooltip2 } from '@blueprintjs/popover2';
import cn from 'classnames';
import { useBlocker } from 'react-router-dom';
import { useFormContext } from './Form';

interface Props {
  isFetching?: boolean;
  children: JSX.Element[] | JSX.Element;
}

export default function OptionsForm({ children, isFetching }: Props) {
  const form = useFormContext();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      {children}
      <form.Subscribe
        selector={(s) => [
          form.state.canSubmit,
          form.state.isDefaultValue,
          form.state.isSubmitting,
          form.state.errors.length > 0,
        ]}
        children={([canSubmit, isDefault, isSubmitting, errors]) => {
          const blocker = useBlocker(!isDefault);

          return (
            <>
              <ButtonGroup>
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    form.handleSubmit();
                  }}
                  intent="success"
                  disabled={!canSubmit || isDefault || isFetching}
                  type="submit"
                >
                  {isSubmitting ? '...' : 'Save'}
                </Button>
                <Button
                  icon="reset"
                  disabled={isDefault}
                  onClick={(e) => {
                    e.preventDefault();
                    form.reset();
                  }}
                  type="reset"
                >
                  Reset
                </Button>
                {errors && (
                  <Tooltip2
                    intent="danger"
                    content={
                      <ul className={Classes.LIST_UNSTYLED}>
                        {form.state.errors.map((e) =>
                          Object.keys(e).map((k) => (
                            <li>
                              <b>{k}</b>: {e[k].map((p: any) => p.message).join('\n')}
                            </li>
                          )),
                        )}
                      </ul>
                    }
                  >
                    <Tag intent="danger" icon="error" />
                  </Tooltip2>
                )}
              </ButtonGroup>
              <Alert
                icon="warning-sign"
                isOpen={blocker.state === 'blocked'}
                confirmButtonText="Discard"
                cancelButtonText="Cancel"
                canOutsideClickCancel
                onConfirm={() => blocker.proceed?.()}
                onCancel={() => blocker.reset?.()}
              >
                You have unsaved changes!
              </Alert>
            </>
          );
        }}
      />
    </form>
  );
}
