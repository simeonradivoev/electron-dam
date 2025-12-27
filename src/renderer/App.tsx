import { FocusStyleManager, Spinner } from '@blueprintjs/core';
import { useMutation, useQuery } from '@tanstack/react-query';
import { IDBPDatabase } from 'idb/with-async-ittr';
import { useCallback, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import './App.scss';
import ProjectSelection from './components/ProjectSelection';
import SideMenu from './components/SideMenu';
import TasksPanel from './components/TasksPanel/TasksPanel';
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

  const [darkMode, setDarkMode] = useState<boolean>(sessionStorage.getItem('dark-mode') === 'true');

  useEffect(() => {
    sessionStorage.setItem('dark-mode', darkMode.toString());
  }, [darkMode]);

  return projectDirectory ? (
    <AppContextProvider
      setDarkMode={setDarkMode}
      darkMode={darkMode}
      projectDir={projectDirectory}
      database={database}
      mutateProjectDir={mutateProjectDir}
      setSelectedProjectDirectory={setSelectedProjectDirectory}
    >
      <TasksProvider>
        <TitleBar setSelectedProjectDirectory={setSelectedProjectDirectory} />
        <div className={`theme-wrapper ${darkMode ? 'bp4-dark dark' : ''}`}>
          {projectDirectory && (
            <>
              <SideMenu />
              <div className="viewport">
                <Outlet />
              </div>
            </>
          )}
        </div>
        <TasksPanel />
      </TasksProvider>
    </AppContextProvider>
  ) : (
    <>
      {!loadingProjectDir && !placeholderProject && !projectDirectory && (
        <ProjectSelection setSelectedProjectDirectory={setSelectedProjectDirectory} />
      )}
      {(loadingProjectDir || placeholderProject) && <Spinner />}
    </>
  );
}

export default App;
