import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createContext } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter as Router, Route, Routes } from 'react-router-dom';
import App from './App';
import BundleEditor from './components/Bundles/BundleEditor';
import BundleDetailsLayout from './components/Bundles/BundleDetailsLayout';
import BundleInfoPreview from './components/Bundles/BundleInfoPreview';
import BundlesGrid from './components/Bundles/BundlesGrid';
import BundleNew from './components/Bundles/BundleNew';
import Explorer from './components/ExplorerPanel/Explorer';
import Settings from './components/Settings/Settings';
import BundlesLayout from './components/Bundles/BundlesLayout';

const container = document.getElementById('root')!;
const root = createRoot(container);
const queryClient = new QueryClient();

root.render(
  <QueryClientProvider client={queryClient}>
    <Router>
      <Routes>
        <Route path="/" element={<App />}>
          <Route index element={<></>} />
          <Route path="bundles/*" element={<BundlesLayout />}>
            <Route index element={<BundlesGrid />} />
            <Route path=":file/*" element={<BundleDetailsLayout />}>
              <Route path="info" element={<BundleInfoPreview />} />
              <Route path="edit" element={<BundleEditor />} />
            </Route>
            <Route path="new" element={<BundleNew />} />
          </Route>
          <Route path="explorer/*" element={<Explorer />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  </QueryClientProvider>
);
