import { useState } from 'react';
import { SiHumblebundle } from 'react-icons/si';
import { LoginProvider } from 'shared/constants';

export const ProviderIcons: Record<LoginProvider, JSX.Element | undefined> = {
  humble: <SiHumblebundle />,
};

const RegisterBundleMethods = (): {
  showBundleInfo: boolean;
  setShowBundleInfo: (show: boolean) => void;
} => {
  const [showBundleInfo, setShowBundleInfo] = useState<boolean>(false);

  return { showBundleInfo, setShowBundleInfo };
};

export default RegisterBundleMethods;
