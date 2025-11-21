import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext } from 'react';
import { createRoot } from 'react-dom/client';
import {
  HashRouter as Router,
  Route,
  Routes,
  ScrollRestoration,
  createHashRouter,
  RouterProvider,
} from 'react-router-dom';
import App from './App';
import BundleEditor from './components/Bundles/BundleEditor';
import BundleDetailsLayout from './components/Bundles/BundleDetailsLayout';
import BundleInfoPreview from './components/Bundles/BundleInfoPreview';
import BundlesGrid from './components/Bundles/BundlesGrid';
import BundleNew from './components/Bundles/BundleNew';
import Explorer from './components/ExplorerPanel/Explorer';
import Settings from './components/Settings/Settings';
import BundlesLayout from './components/Bundles/BundlesLayout';
import Home from './components/HomePanel/Home';
import TasksPage from './components/TasksPanel/TasksPage';

const container = document.getElementById('root')!;
const root = createRoot(container);
const queryClient = new QueryClient();
const route = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      {
        path: 'bundles',
        children: [
          { index: true, element: <BundlesGrid /> },
          {
            path: ':file/*',
            element: <BundleDetailsLayout />,
            children: [
              { path: 'info', element: <BundleInfoPreview /> },
              { path: 'edit', element: <BundleEditor /> },
            ],
          },
          { path: 'new', element: <BundleNew /> },
        ],
      },
      {
        path: 'explorer/*',
        element: <Explorer />,
      },
      { path: 'tasks', element: <TasksPage /> },
      { path: 'settings', element: <Settings /> },
    ],
  },
]);

root.render(
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={route} />
  </QueryClientProvider>
);
