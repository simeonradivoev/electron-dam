import { useState } from 'react';

const RegisterBundleMethods = (): {
  showBundleInfo: boolean;
  setShowBundleInfo: (show: boolean) => void;
} => {
  const [showBundleInfo, setShowBundleInfo] = useState<boolean>(false);

  return { showBundleInfo, setShowBundleInfo };
};

export default RegisterBundleMethods;
