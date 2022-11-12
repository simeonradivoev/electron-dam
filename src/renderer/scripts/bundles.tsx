import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const RegisterBundleMethods = (): {
  showBundleInfo: boolean;
  setShowBundleInfo: (show: boolean) => void;
} => {
  const [showBundleInfo, setShowBundleInfo] = useState<boolean>(false);

  return { showBundleInfo, setShowBundleInfo };
};

export default RegisterBundleMethods;
