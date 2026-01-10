import { Button, Card, H2, H5, Intent, ProgressBar, Text, Icon } from '@blueprintjs/core';
import '../../App.scss';
import { useTasks } from '../../contexts/TasksContext';

function TasksPage() {
  const { tasks, cancelTask } = useTasks();

  const getStatusIcon = (status: string) => {
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
  };

  return (
    <div className="tasks-page">
      <H2 className="tasks-header">Active Tasks</H2>

      {tasks.length === 0 ? (
        <Card className="tasks-empty">
          <Icon icon="inbox" size={48} />
          <Text>No active tasks</Text>
        </Card>
      ) : (
        <div className="tasks-container">
          {tasks.map((task) => (
            <Card
              key={task.id}
              elevation={1}
              className={`task-card status-${task.status.toLowerCase()}`}
            >
              <div className="task-header">
                <div className="task-title">
                  {getStatusIcon(task.status)}
                  <H5>{task.label}</H5>
                </div>
                <Text className="task-status">{task.status}</Text>
              </div>

              {task.status === 'RUNNING' && task.progress && (
                <div className="task-progress">
                  <div className="progress-row">
                    <div className="progress-bar-container">
                      <ProgressBar value={task.progress} />
                    </div>
                    <span className="progress-percentage">{Math.round(task.progress * 100)}%</span>
                  </div>
                </div>
              )}

              {task.error && <Text className="task-error">{task.error}</Text>}

              <div className="task-actions">
                {(task.status === 'PENDING' || task.status === 'RUNNING') && (
                  <Button
                    size="small"
                    intent={Intent.DANGER}
                    onClick={() => cancelTask(task.id)}
                    text="Cancel"
                  />
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default TasksPage;
