import { IDBPDatabase } from 'idb';
import { normalize } from 'pathe';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useMatch, useNavigate } from 'react-router-dom';
import { BuildNodeQueries } from 'renderer/scripts/file-tree';
import {
  GetSelectedTags,
  GetTypeFilter,
  ToggleTag,
  ToggleFileType,
} from 'renderer/scripts/filters';
import RegisterFileLoadFile from 'renderer/scripts/loader';
import { FileType } from 'shared/constants';
import { useSessionStorage } from 'usehooks-ts';

export interface AppContextSchema {
  focusedItem: string | undefined;
  setFocusedItem: (item: string) => void;
  typeFilter: FileType[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  toggleType: (type: FileType) => void;
  filter: string | null;
  setFilter: React.Dispatch<React.SetStateAction<string | null>>;
  sideBarSize: number;
  database: Promise<IDBPDatabase<FilesDB>>;
  setSideBarSize: (size: number) => void;
  setFileInfo: (fileInfo: FileInfo | null) => void;
  fileInfo: FileInfo | null;
  projectDirectory: string | null | undefined;
  clearSelectedProjectDirectory: () => void;
  viewInExplorer: (id: string) => void;
  inspectBundle: (id: string) => void;
  setSelectedProjectDirectory: (directory: string | null) => void;
}

interface AppContextProviderParams {
  projectDir: string;
  database: Promise<IDBPDatabase<FilesDB>>;
  children: ReactNode | ReactNode[];
  mutateProjectDir: (path: string | null) => void;
  setSelectedProjectDirectory: (path: string | null) => void;
}

const AppContext = createContext<AppContextSchema | undefined>(undefined);
const focusedItemKey = 'focused-item';

export function AppContextProvider({
  children,
  projectDir,
  database,
  mutateProjectDir,
  setSelectedProjectDirectory,
}: AppContextProviderParams) {
  const { fileInfo, setFileInfo } = RegisterFileLoadFile();
  const navigate = useNavigate();
  const [selectedTags, setSelectedTags] = useState<string[]>(GetSelectedTags);
  const [typeFilter, setTypeFilter] = useState<FileType[]>(GetTypeFilter);
  const [filter, setFilter] = useState<string | null>(null);
  const focusedMatch = useMatch('explorer/:focusedId');
  const [focusedItem, setFocusedItem] = useSessionStorage<string | undefined>(
    focusedItemKey,
    undefined,
  );

  BuildNodeQueries(projectDir, database);

  const [sideBarSize, setSideBarSize] = useState<number>(
    Number(window.localStorage.getItem('sideBarSize') ?? 30),
  );

  const clearSelectedProjectDirectory = useCallback(
    () => mutateProjectDir(null),
    [mutateProjectDir],
  );

  const viewInExplorer = useCallback(
    (id: string) => {
      navigate({
        pathname: `/explorer/${encodeURIComponent(normalize(id))}`,
        search: `?focus=${encodeURIComponent(normalize(id))}`,
      });
    },
    [navigate],
  );

  const inspectBundle = useCallback(
    (id: string) => {
      navigate({
        pathname: `/bundles/${encodeURIComponent(id)}/info`,
      });
    },
    [navigate],
  );

  useEffect(() => {
    if (focusedMatch) {
      setFocusedItem(focusedMatch.params.focusedId);
    }
  }, [focusedMatch, setFocusedItem]);

  const toggleTag = useCallback(
    (tag: string) => ToggleTag(tag, selectedTags, setSelectedTags),
    [selectedTags],
  );
  const toggleType = useCallback(
    (type: FileType) => ToggleFileType(type, typeFilter, setTypeFilter),
    [typeFilter],
  );

  const contextValue: AppContextSchema = useMemo(
    () =>
      ({
        focusedItem,
        setFocusedItem,
        typeFilter,
        selectedTags,
        toggleTag,
        toggleType,
        filter,
        setFilter,
        sideBarSize,
        database,
        setSideBarSize,
        setFileInfo,
        fileInfo,
        projectDirectory: projectDir,
        clearSelectedProjectDirectory,
        viewInExplorer,
        setSelectedProjectDirectory,
        inspectBundle,
      }) satisfies AppContextSchema,
    [
      focusedItem,
      setFocusedItem,
      typeFilter,
      selectedTags,
      toggleTag,
      toggleType,
      filter,
      sideBarSize,
      database,
      setFileInfo,
      fileInfo,
      projectDir,
      clearSelectedProjectDirectory,
      viewInExplorer,
      setSelectedProjectDirectory,
      inspectBundle,
    ],
  );

  return <AppContext.Provider value={contextValue}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a AppProvider');
  }
  return context;
}
