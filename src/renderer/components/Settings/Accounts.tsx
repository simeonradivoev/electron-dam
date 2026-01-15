import { Button, ButtonGroup, FormGroup, Spinner, SpinnerSize } from '@blueprintjs/core';
import { Tag } from '@blueprintjs/icons';
import { useIsMutating, useMutation, useQuery } from '@tanstack/react-query';
import React from 'react';
import { SiHumblebundle } from 'react-icons/si';
import { LoginProvider } from 'shared/constants';

function AccountField({
  type,
  icon,
  title,
}: {
  type: LoginProvider;
  icon: JSX.Element;
  title: string;
}) {
  const isLoggingIn = useIsMutating({ mutationKey: ['login', type] }) > 0;
  const isLoggingOut = useIsMutating({ mutationKey: ['logout', type] }) > 0;

  const humbleLoggedIn = useQuery({
    queryKey: ['loggedIn', type],
    queryFn: () => window.api.checkLogin(type),
  });

  const loginMutation = useMutation({
    mutationKey: ['login', 'humble'],
    mutationFn: () => window.api.login(type),
  });

  const logoutMutation = useMutation({
    mutationKey: ['logout', 'humble'],
    mutationFn: () => window.api.logout(type),
  });

  const loginStatus = humbleLoggedIn.data === true ? 'Logged In' : 'Unknown';

  return (
    <FormGroup
      label={
        <>
          {icon} {title}
        </>
      }
    >
      <ButtonGroup>
        <Button
          variant="minimal"
          icon={!humbleLoggedIn.isFetching && humbleLoggedIn.data === true ? 'tick' : undefined}
        >
          {humbleLoggedIn.isPending || humbleLoggedIn.isFetching ? (
            <Spinner size={SpinnerSize.SMALL} />
          ) : (
            loginStatus
          )}
        </Button>
        <Button
          icon="log-in"
          intent="primary"
          disabled={humbleLoggedIn.data === true || humbleLoggedIn.isFetching || isLoggingIn}
          endIcon={loginMutation.isPending && <Spinner size={SpinnerSize.SMALL} />}
          onClick={() => loginMutation.mutate()}
        >
          Login
        </Button>
        <Button
          disabled={humbleLoggedIn.data !== true || humbleLoggedIn.isFetching || isLoggingOut}
          intent="danger"
          icon="log-out"
          onClick={() => logoutMutation.mutate()}
        >
          Logout
        </Button>
      </ButtonGroup>
    </FormGroup>
  );
}

export default function Accounts() {
  return (
    <AccountField type={LoginProvider.Humble} title="Humble Bundles" icon={<SiHumblebundle />} />
  );
}
