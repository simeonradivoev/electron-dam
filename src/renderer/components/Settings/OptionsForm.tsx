/* eslint-disable react/no-children-prop */
import { Alert, Button, ButtonGroup, Classes, Tag, Tooltip } from '@blueprintjs/core';
import { useBlocker } from 'react-router-dom';
import { useFormContext } from './Form';

interface Props {
  isFetching?: boolean;
  children: JSX.Element[] | JSX.Element;
}

export default function OptionsForm({ children, isFetching = false }: Props) {
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
        selector={() => [
          form.state.canSubmit,
          form.state.isDefaultValue,
          form.state.isSubmitting,
          form.state.errors.length > 0,
        ]}
        children={([canSubmit, isDefault, isSubmitting, errors]) => {
          // eslint-disable-next-line react-hooks/rules-of-hooks
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
                  <Tooltip
                    intent="danger"
                    content={
                      <ul className={Classes.LIST_UNSTYLED}>
                        {form.state.errors.map((e) =>
                          Object.keys(e).map((k) => (
                            <li>
                              <b>{k}</b>: {e[k].map((p: Error) => p.message).join('\n')}
                            </li>
                          )),
                        )}
                      </ul>
                    }
                  >
                    <Tag intent="danger" icon="error" />
                  </Tooltip>
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
