import React, { useContext } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';

export type BundlesContextType = {
  viewInExplorer: (id: string | number) => void;
};

const BundlesLayout = () => {
  const { setSelected } = useContext(AppContext);
  const navigate = useNavigate();

  const viewInExplorer = (id: string | number) => {
    setSelected(id, true);
    navigate({
      pathname: '/explorer',
      search: `?focus=${id}`,
    });
  };

  return <Outlet context={{ viewInExplorer } as BundlesContextType} />;
};

export default BundlesLayout;
