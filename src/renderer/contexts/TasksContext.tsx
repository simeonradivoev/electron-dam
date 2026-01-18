/* eslint-disable promise/always-return */
/* eslint-disable promise/catch-or-return */
import {
  Button,
  H5,
  IconName,
  IconSize,
  Intent,
  NonIdealState,
  ProgressBar,
  Size,
  Spinner,
  ToastProps,
} from '@blueprintjs/core';
import { hashKey, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo } from 'react';
import { useApp } from 'renderer/contexts/AppContext';
import { AppToaster, ShowAppToaster } from 'renderer/scripts/toaster';
import { TaskUpdateType } from 'shared/constants';
import { useSessionStorage } from 'usehooks-ts';

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
  const [taskHistory, setTaskHistory] = useSessionStorage<TaskMetadata[]>('taskHistory', []);

  const cancelTask = useCallback((id: string) => {
    window.api.cancelTask(id);
  }, []);

  const buildToasterParams = useCallback(
    (task: TaskMetadata) => {
      const props: ToastProps = {
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
                  size={Size.SMALL}
                  variant="minimal"
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

      return props;
    },
    [cancelTask],
  );

  // First tasks
  useEffect(() => {
    tasks?.forEach((t) => ShowAppToaster(buildToasterParams(t), `task-${t.id}`));
  }, [isPending]);

  useEffect(() => {
    // Listen for task updates
    const removeListener = window.apiCallbacks.onTasksUpdate((type, tasksParam) => {
      if (type === TaskUpdateType.Ended) {
        setTaskHistory([...tasksParam, ...taskHistory.slice(0, 32)]);
        const newParams = buildToasterParams(tasksParam[0]);
        newParams.timeout = 2000;
        ShowAppToaster(newParams, `task-${tasksParam[0].id}`);
      } else if (type === TaskUpdateType.Added) {
        if (tasksParam[0].options.silent !== true) {
          ShowAppToaster(buildToasterParams(tasksParam[0]), `task-${tasksParam[0].id}`);
        }
      } else if (type === TaskUpdateType.Structure) {
        const taskIndex = tasksParam.findIndex((t) => t.id === tasksParam[0].id);
        const newTasks = Array.from(tasksParam);
        newTasks[taskIndex] = tasksParam[taskIndex];
        // Use a function to ensure React sees this as a state change
        queryClient.setQueryData(['tasks', projectDirectory], newTasks);
      } else if (type === TaskUpdateType.Update) {
        // Use a function to ensure React sees this as a state change
        queryClient.setQueryData(['tasks', projectDirectory], tasksParam);
        AppToaster.then((toaster) => {
          const existingToast = toaster
            .getToasts()
            .find((t) => t.key === `task-${tasksParam[0].id}`);
          if (existingToast) {
            const existingHash = hashKey([
              existingToast.message,
              existingToast.action,
              existingToast.icon,
              existingToast.intent,
              existingToast.isCloseButtonShown,
            ]);
            const newProps = buildToasterParams(tasksParam[0]);
            const hash = hashKey([
              newProps.message,
              newProps.action,
              newProps.icon,
              newProps.intent,
              newProps.isCloseButtonShown,
            ]);
            if (existingHash !== hash) {
              ShowAppToaster(newProps, `task-${tasksParam[0].id}`);
            }
          }
        });
      }
    });

    return () => {
      removeListener();
    };
  }, [buildToasterParams, projectDirectory, queryClient, setTaskHistory, taskHistory]);

  const taskContext = useMemo(
    (): TasksContextType => ({ cancelTask, tasks: tasks ?? [], isPending }),
    [isPending, tasks, setTaskHistory],
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
