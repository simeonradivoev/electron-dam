import React, { useContext } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { AppContext } from 'renderer/AppContext';

type BundlesContextType = {};

const BundlesLayout = () => {
  return <Outlet context={{} as BundlesContextType} />;
};

export default BundlesLayout;
