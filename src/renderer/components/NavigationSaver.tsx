import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export function NavigationSaver() {
  const location = useLocation();
  const navigate = useNavigate();

  // Save the current path to localStorage
  useEffect(() => {
    localStorage.setItem('lastPath', location.pathname);
  }, [location]);

  // On mount, restore path
  useEffect(() => {
    const savedPath = localStorage.getItem('lastPath');
    if (savedPath && savedPath !== location.pathname) {
      navigate(savedPath, { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}

export function NavigationRestorer() {
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('navState');
    if (!saved) return;

    const { pathname, search, hash } = JSON.parse(saved);
    const fullPath = `${pathname}${search}${hash}`;

    // Only navigate if different from current location
    if (fullPath !== window.location.hash.replace('#', '')) {
      navigate(fullPath, { replace: true });
    }
  }, [navigate]);

  return null;
}
