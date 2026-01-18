import {
  Button,
  Card,
  H2,
  H5,
  Intent,
  ProgressBar,
  Text,
  Icon,
  NonIdealState,
  Classes,
} from '@blueprintjs/core';
import classNames from 'classnames';
import { useCallback } from 'react';
import { useSessionStorage } from 'usehooks-ts';
import '../../App.scss';
import { useTasks } from '../../contexts/TasksContext';

function Task({
  task,
  cancelTask,
  isHistory,
}: {
  task: TaskMetadata;
  cancelTask?: (id: string) => void;
  isHistory: boolean;
}) {
  const getStatusIcon = useCallback((status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Icon icon="tick" intent={Intent.SUCCESS} />;
      case 'FAILED':
        return <Icon icon="cross" intent={Intent.DANGER} />;
      case 'CANCELED':
        return <Icon icon="stop" intent={Intent.WARNING} />;
      case 'RUNNING':
        return <Icon icon="play" intent={Intent.PRIMARY} />;
      default:
        return <Icon icon="pause" intent={Intent.NONE} />;
    }
  }, []);

  return (
    <Card
      key={task.id}
      elevation={1}
      className={classNames(`task-card status-${task.status.toLowerCase()}`, {
        active: !isHistory,
      })}
    >
      <div className={classNames('task-header', { [Classes.TEXT_MUTED]: isHistory })}>
        <div className="task-title">
          {isHistory ? <Icon icon={task.options.icon} /> : getStatusIcon(task.status)}
          <H5 className={classNames({ [Classes.TEXT_MUTED]: isHistory })}>{task.label}</H5>
        </div>
        <Text className="task-status">{task.status}</Text>
      </div>

      {task.status === 'RUNNING' && (
        <div className="task-progress">
          <div className="progress-row">
            <div className="progress-bar-container">
              <ProgressBar intent="primary" value={task.progress} />
            </div>
            {!!task.progress && (
              <span className="progress-percentage">
                {task.progress.toLocaleString(undefined, { style: 'percent' })}
              </span>
            )}
          </div>
        </div>
      )}

      {task.error && <Text className="task-error">{task.error}</Text>}

      <div className="task-actions">
        {(task.status === 'PENDING' || task.status === 'RUNNING') && (
          <Button
            size="small"
            intent={Intent.DANGER}
            onClick={() => cancelTask?.(task.id)}
            text="Cancel"
          />
        )}
      </div>
    </Card>
  );
}

function TasksPage() {
  const { tasks, cancelTask } = useTasks();
  const [taskHistory, setTaskHistory] = useSessionStorage<TaskMetadata[]>('taskHistory', []);

  return (
    <div className="tasks-page">
      <H2 className="tasks-header">Active Tasks</H2>

      <div className="tasks-container active">
        {tasks.length <= 0 && (
          <NonIdealState className="tasks-empty" icon="inbox">
            No Active Tasks
          </NonIdealState>
        )}
        {tasks.map((task) => (
          <Task task={task} isHistory={false} cancelTask={cancelTask} />
        ))}
      </div>
      <H2 className="tasks-header">
        History{' '}
        <Button
          style={{ marginLeft: 'auto' }}
          variant="minimal"
          icon="trash"
          onClick={() => setTaskHistory([])}
        />
      </H2>
      <div className="tasks-container">
        {taskHistory.length > 0 && taskHistory.map((task) => <Task isHistory task={task} />)}
      </div>
    </div>
  );
}

export default TasksPage;
