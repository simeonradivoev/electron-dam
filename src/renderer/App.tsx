import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import './App.scss';
import { useEffect, useRef, useState } from 'react';
import Split from 'react-split';
import { IDBPDatabase, openDB } from 'idb/with-async-ittr';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FocusStyleManager, Toaster, ToasterInstance } from '@blueprintjs/core';
import { FileType } from 'shared/constants';
import ExplorerBar from './components/ExplorerPanel/ExplorerBar';
import FileInfoPanel from './components/FileInfoPanel/FileInfoPanel';
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
import Bundles from './components/Bundles/Bundles';
import Settings from './components/Settings/Settings';
import TitleBar from './components/TitleBar';

FocusStyleManager.onlyShowFocusOnTabs();

const App: React.FC = () => {
  const queryClient = useQueryClient();

  const { fileInfo, importedMesh, importedAudio, importedImage, setFileInfo } =
    RegisterFileLoadFile();

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

  const { nodes, setSelectedMutation, setExpandedMutation } = BuildNodeQueries(
    projectDirectory,
    queryClient,
    selectedTags,
    typeFilter,
    filter,
    database,
    setFileInfo
  );
  const setSelected = (id: string | number, selected: boolean) =>
    setSelectedMutation.mutate({
      id,
      selected,
    });

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
      const db = await openDB<FilesDB>('selection database', 3, {
        upgrade(udb, oldVersion, newVersion, transaction) {
          if (!udb.objectStoreNames.contains('files')) {
            udb.createObjectStore('files');
          } else {
            transaction.objectStore('files');
          }
          setDatabase(udb);
        },
      });

      setDatabase(db);
    };

    loadDatabase();
  }, [setDatabase]);

  return (
    <>
      <TitleBar
        projectDirectory={projectDirectory}
        setSelectedProjectDirectory={setSelectedProjectDirectory}
      />
      <div className={`theme-wrapper ${darkMode ? 'bp4-dark dark' : ''}`}>
        {projectDirectory.data ? (
          <Router>
            <SideMenu />
            <div className="viewport">
              <Routes>
                <Route path="/" element={<></>} />
                <Route
                  path="/bundles"
                  element={
                    <Bundles
                      database={database}
                      setFileInfo={setFileInfo}
                      nodes={nodes}
                      setSelected={setSelected}
                      fileInfo={fileInfo}
                      filter={filter}
                    />
                  }
                />
                <Route
                  path="/explorer"
                  element={
                    <Split
                      direction="horizontal"
                      cursor="col-resize"
                      className="wrap"
                      snapOffset={30}
                      minSize={100}
                      expandToMin={false}
                      gutterSize={10}
                      sizes={[sideBarSize, 100 - sideBarSize]}
                      onDragEnd={(size) => {
                        setSideBarSize(size[0]);
                        window.sessionStorage.setItem(
                          'sideBarSize',
                          String(size[0])
                        );
                      }}
                    >
                      <ExplorerBar
                        typeFilter={typeFilter}
                        toggleType={(type) =>
                          ToggleFileType(type, typeFilter, setTypeFilter)
                        }
                        selectedTags={selectedTags}
                        toggleTag={(tag: string) =>
                          ToggleTag(
                            queryClient,
                            database,
                            tag,
                            selectedTags,
                            setSelectedTags
                          )
                        }
                        files={nodes}
                        setSelected={setSelected}
                        setExpanded={(path, expanded) =>
                          setExpandedMutation.mutate({
                            path,
                            expanded,
                          })
                        }
                        tags={tags}
                        filter={filter}
                        setFilter={setFilter}
                      />
                      <FileInfoPanel
                        panelSize={100 - sideBarSize}
                        importedMesh={importedMesh}
                        importedImage={importedImage}
                        importedAudio={importedAudio}
                        fileInfo={fileInfo}
                        database={database}
                        setSelected={setSelected}
                        filter={filter}
                      />
                    </Split>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <Settings darkMode={darkMode} setDarkMode={setDarkMode} />
                  }
                />
              </Routes>
            </div>
          </Router>
        ) : (
          <ProjectSelection
            setSelectedProjectDirectory={setSelectedProjectDirectory}
          />
        )}
      </div>
    </>
  );
};

export default App;
