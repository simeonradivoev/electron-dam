import { Outlet } from 'react-router-dom';
import './App.scss';
import { useEffect, useState } from 'react';
import { IDBPDatabase, openDB } from 'idb/with-async-ittr';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FocusStyleManager } from '@blueprintjs/core';
import { FileType } from 'shared/constants';
import RegisterFileLoadFile from './scripts/loader';
import {
  ToggleTag,
  LoadGlobalTags,
  GetSelectedTags,
  GetTypeFilter,
  ToggleFileType,
} from './scripts/filters';
import { BuildNodeQueries, GetProjectDirectory } from './scripts/file-tree';
import ProjectSelection from './components/ProjectSelection';
import SideMenu from './components/SideMenu';
import TitleBar from './components/TitleBar';
import { AppContext } from './AppContext';

FocusStyleManager.onlyShowFocusOnTabs();

const App: React.FC = () => {
  const queryClient = useQueryClient();

  const { fileInfo, setFileInfo } = RegisterFileLoadFile();

  const projectDirectory = useQuery<string | null>(
    ['project-directory'],
    GetProjectDirectory,
    {
      refetchOnWindowFocus: false,
    }
  );
  const projectDirectoryMutation = useMutation(
    ['project-directory'],
    async ({ path }: { path: string | null }) => {
      return path;
    },
    {
      onSuccess: (result: string | null) => {
        queryClient.setQueriesData(['project-directory'], result);
      },
    }
  );

  useEffect(() => {
    return window.api.onProjectDirectoryUpdate((path) => {
      projectDirectoryMutation.mutate({ path });
    });
  }, [projectDirectoryMutation]);
  const [selectedTags, setSelectedTags] = useState<string[]>(GetSelectedTags);
  const [typeFilter, setTypeFilter] = useState<FileType[]>(GetTypeFilter);
  const [database, setDatabase] = useState<IDBPDatabase<FilesDB> | undefined>();
  const [darkMode, setDarkMode] = useState<boolean>(
    sessionStorage.getItem('dark-mode') === 'true'
  );
  const [filter, setFilter] = useState<string | undefined>();

  const { nodes, setSelected, setExpandedMutation } = BuildNodeQueries(
    projectDirectory,
    queryClient,
    selectedTags,
    typeFilter,
    filter,
    database,
    setFileInfo
  );

  const [sideBarSize, setSideBarSize] = useState<number>(
    Number(window.sessionStorage.getItem('sideBarSize') ?? 30)
  );

  const tags = useQuery<string[]>(
    ['tags', database, projectDirectory],
    LoadGlobalTags,
    {
      enabled: !!nodes.data && !!database && !!projectDirectory,
      refetchOnWindowFocus: false,
    }
  );

  const setSelectedProjectDirectory = (path: string | null) =>
    projectDirectoryMutation.mutate({ path });

  useEffect(() => {
    sessionStorage.setItem('dark-mode', darkMode.toString());
  }, [darkMode]);

  useEffect(() => {
    const loadDatabase = async () => {
      const db = await openDB<FilesDB>('selection database', 4, {
        upgrade(udb, oldVersion, newVersion, transaction) {
          if (!udb.objectStoreNames.contains('selected')) {
            udb.createObjectStore('selected');
          } else {
            transaction.objectStore('selected');
          }
          if (!udb.objectStoreNames.contains('expanded')) {
            udb.createObjectStore('expanded');
          } else {
            transaction.objectStore('expanded');
          }
          setDatabase(udb);
        },
      });

      setDatabase(db);
    };

    loadDatabase();
  }, [setDatabase]);

  return (
    <AppContext.Provider
      value={{
        files: nodes,
        setSelected,
        setExpanded: (path, expanded) =>
          setExpandedMutation.mutate({
            path,
            expanded,
          }),
        tags,
        typeFilter,
        selectedTags,
        toggleTag: (tag) =>
          ToggleTag(queryClient, database, tag, selectedTags, setSelectedTags),
        toggleType: (type) => ToggleFileType(type, typeFilter, setTypeFilter),
        filter,
        setFilter,
        sideBarSize,
        database,
        darkMode,
        setDarkMode,
        setSideBarSize,
        setFileInfo,
        fileInfo,
      }}
    >
      <TitleBar
        projectDirectory={projectDirectory}
        setSelectedProjectDirectory={setSelectedProjectDirectory}
      />
      <div className={`theme-wrapper ${darkMode ? 'bp4-dark dark' : ''}`}>
        {projectDirectory.data ? (
          <>
            <SideMenu />
            <div className="viewport">
              <Outlet />
            </div>
          </>
        ) : (
          <ProjectSelection
            setSelectedProjectDirectory={setSelectedProjectDirectory}
          />
        )}
      </div>
    </AppContext.Provider>
  );
};

export default App;
