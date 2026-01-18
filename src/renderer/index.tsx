import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { openDB } from 'idb';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import App from './App';
import BundleDetailsLayout from './components/Bundles/BundleDetailsLayout';
import BundleEditor from './components/Bundles/BundleEditor';
import BundleInfoPreview from './components/Bundles/BundleInfoPreview';
import BundleNew from './components/Bundles/BundleNew';
import BundlesGrid from './components/Bundles/BundlesGrid';
import Explorer from './components/ExplorerPanel/Explorer';
import Home from './components/HomePanel/Home';
import SearchPage from './components/SearchPage/SearchPage';
import Settings from './components/Settings/Settings';
import TasksPage from './components/TasksPanel/TasksPage';

const container = document.getElementById('root')!;
const root = createRoot(container);
const queryClient = new QueryClient();
const database = openDB<FilesDB>('selection database', 4, {
  upgrade(udb, _oldVersion, _newVersion, transaction) {
    if (!udb.objectStoreNames.contains('expanded')) {
      udb.createObjectStore('expanded');
    } else {
      transaction.objectStore('expanded');
    }
  },
});
const route = createHashRouter(
  [
    {
      path: '/',
      element: <App database={database} />,
      children: [
        { index: true, element: <Home /> },
        {
          path: 'bundles',
          children: [
            { index: true, element: <BundlesGrid /> },
            {
              path: ':mode/:bundleId',
              element: <BundleDetailsLayout />,
            },
            { path: 'new', element: <BundleNew /> },
          ],
        },
        {
          path: 'explorer/*',
          element: <Explorer />,
        },
        { path: 'tasks', element: <TasksPage /> },
        { path: 'search/*', element: <SearchPage /> },
        { path: 'settings/*', element: <Settings /> },
      ],
    },
  ],
  {},
);

// Save navigation
const lastRoute = localStorage.getItem('lastRoute');
if (lastRoute) route.navigate(lastRoute);
route.subscribe((state) => localStorage.setItem('lastRoute', state.location.pathname));

root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={route} />
    </QueryClientProvider>
  </StrictMode>,
);
