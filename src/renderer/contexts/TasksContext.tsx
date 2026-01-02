import { IconName, NonIdealState, ProgressBar } from '@blueprintjs/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { useApp } from 'renderer/contexts/AppContext';

interface TasksContextType {
  tasks: TaskMetadata[];
  cancelTask: (id: string) => void;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export function TasksProvider({ children }: { children: ReactNode | ReactNode[] }) {
  const queryClient = useQueryClient();
  const { projectDirectory } = useApp();
  const { data: tasks } = useQuery({
    queryKey: ['tasks', projectDirectory],
    queryFn: () => window.api.getTasks(),
    placeholderData: [],
  });

  useEffect(() => {
    // Listen for task updates
    const removeListener = window.apiCallbacks.onTasksUpdate((updateTasks) => {
      // Use a function to ensure React sees this as a state change
      queryClient.setQueryData(['tasks', projectDirectory], updateTasks);
    });

    return () => {
      removeListener();
    };
  }, [projectDirectory, queryClient]);

  const cancelTask = (id: string) => {
    window.api.cancelTask(id);
  };

  const taskContext = useMemo(
    (): TasksContextType => ({ cancelTask, tasks: tasks ?? [] }),
    [tasks],
  );

  const blockingTasks = useMemo(
    () =>
      tasks?.filter(
        (t) => t.options.blocking && (t.status === 'PENDING' || t.status === 'RUNNING'),
      ),
    [tasks],
  );

  return (
    <TasksContext.Provider value={taskContext}>
      {blockingTasks && blockingTasks?.length > 0 ? (
        <NonIdealState
          icon={blockingTasks[0].options.icon as IconName}
          title={blockingTasks[0].label}
        >
          <ProgressBar intent="primary" value={blockingTasks[0].progress} />
        </NonIdealState>
      ) : (
        children
      )}
    </TasksContext.Provider>
  );
}

export const useTasks = () => {
  const context = useContext(TasksContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TasksProvider');
  }
  return context;
};
