import {
  Button,
  H5,
  IconName,
  IconSize,
  Intent,
  NonIdealState,
  ProgressBar,
  Spinner,
  ToastProps,
} from '@blueprintjs/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useContext, useEffect, useMemo } from 'react';
import { useApp } from 'renderer/contexts/AppContext';
import { AppToaster } from 'renderer/scripts/toaster';

interface TasksContextType {
  isPending: boolean;
  tasks: TaskMetadata[];
  cancelTask: (id: string) => void;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export function TasksProvider({ children }: { children: ReactNode | ReactNode[] }) {
  const queryClient = useQueryClient();
  const { projectDirectory } = useApp();
  const { data: tasks, isPending } = useQuery({
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
    (): TasksContextType => ({ cancelTask, tasks: tasks ?? [], isPending }),
    [isPending, tasks],
  );

  const blockingTasks = useMemo(
    () =>
      tasks?.filter(
        (t) => t.options.blocking && (t.status === 'PENDING' || t.status === 'RUNNING'),
      ),
    [tasks],
  );

  useEffect(() => {
    if (tasks) {
      // eslint-disable-next-line promise/always-return
      AppToaster.then((toaster) => {
        const existinToastKeys = toaster.getToasts().map((t) => t.key);
        const taskSet = new Set(
          tasks
            .filter((t) => t.options.silent !== true && t.options.blocking !== true)
            .map((t) => t.id),
        );
        existinToastKeys
          .filter((t) => t.startsWith('task-') && !taskSet.has(t.substring('task-'.length)))
          .forEach((t) => toaster.dismiss(t));
        tasks
          .filter((t) => t.options.silent !== true && t.options.blocking !== true)
          .forEach((task) => {
            const props: ToastProps = {
              timeout: 0,
              intent: task.error ? 'danger' : 'none',
              icon: task.options.icon as IconName,
              isCloseButtonShown: false,
              message: (
                <div className="task-card">
                  <div className="task-header">
                    <H5>{task.label}</H5>
                  </div>

                  {task.error}

                  <div className="task-actions">
                    {(task.status === 'PENDING' || task.status === 'RUNNING') && (
                      <Button
                        small
                        minimal
                        intent={Intent.DANGER}
                        onClick={() => cancelTask(task.id)}
                        text="Cancel"
                      />
                    )}
                  </div>
                </div>
              ),
            };
            switch (task.status) {
              case 'CANCELED':
                props.action = { icon: 'disable' };
                break;
              case 'FAILED':
                props.action = { icon: 'cross' };
                break;
              case 'COMPLETED':
                props.action = { icon: 'tick' };
                break;
              case 'PENDING':
              case 'RUNNING':
                props.action = {
                  icon: task.progress ? (
                    <Spinner size={IconSize.STANDARD} value={task.progress} />
                  ) : (
                    <Spinner size={IconSize.STANDARD} />
                  ),
                  disabled: true,
                };
                break;
              default:
                break;
            }

            toaster.show(props, `task-${task.id}`);
          });
      }).catch(() => {});
    }
  }, [tasks]);

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
