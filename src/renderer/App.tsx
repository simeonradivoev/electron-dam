import { FocusStyleManager, PortalProvider, Spinner } from '@blueprintjs/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools';
import { IDBPDatabase } from 'idb/with-async-ittr';
import { useCallback } from 'react';
import { Outlet } from 'react-router-dom';
import { Options } from 'shared/constants';
import { useLocalStorage, useSessionStorage } from 'usehooks-ts';
import '../../node_modules/file-icons-js/css/style.css';
import './App.scss';
import ProjectSelection from './components/ProjectSelection';
import SideMenu from './components/SideMenu';
import TitleBar from './components/TitleBar';
import { AppContextProvider } from './contexts/AppContext';
import { TasksProvider } from './contexts/TasksContext';

FocusStyleManager.onlyShowFocusOnTabs();

function App({ database }: { database: Promise<IDBPDatabase<FilesDB>> }) {
  const {
    data: projectDirectory,
    isPending: loadingProjectDir,
    isPlaceholderData: placeholderProject,
  } = useQuery({
    refetchOnWindowFocus: false,
    queryKey: ['project-directory'],
    queryFn: () => window.api.getProjectDirectory(),
  });
  const { mutate: mutateProjectDir } = useMutation({
    onSuccess: (result, _variables, _resultData, context) => {
      context.client.setQueriesData({ queryKey: ['project-directory'] }, result);
    },
    mutationKey: ['project-directory'],
    mutationFn: async (path: string | null) => {
      return path;
    },
  });

  const setSelectedProjectDirectory = useCallback(
    (path: string | null) => mutateProjectDir(path),
    [mutateProjectDir],
  );

  const [darkMode] = useLocalStorage(
    'darkMode',
    Options.darkMode.schema.safeParse(undefined).data ?? false,
  );
  const [queryDebugToolsVisible, setQueryDebugToolsVisible] = useSessionStorage(
    'queryDebugTools',
    false,
  );

  return (
    <>
      <TitleBar />
      {projectDirectory ? (
        <AppContextProvider
          projectDir={projectDirectory}
          database={database}
          mutateProjectDir={mutateProjectDir}
          setSelectedProjectDirectory={setSelectedProjectDirectory}
        >
          <TasksProvider>
            <PortalProvider portalClassName="app-portal">
              <div className={`theme-wrapper ${darkMode ? 'bp6-dark dark' : ''}`}>
                {projectDirectory && (
                  <>
                    <SideMenu />
                    <div className="viewport">
                      <Outlet />
                    </div>
                  </>
                )}
              </div>
            </PortalProvider>
          </TasksProvider>
        </AppContextProvider>
      ) : (
        <>
          {!loadingProjectDir && !placeholderProject && !projectDirectory && (
            <ProjectSelection setSelectedProjectDirectory={setSelectedProjectDirectory} />
          )}
          {(loadingProjectDir || placeholderProject) && <Spinner />}
        </>
      )}

      {queryDebugToolsVisible && (
        <ReactQueryDevtoolsPanel onClose={() => setQueryDebugToolsVisible(false)} />
      )}
    </>
  );
}

export default App;
