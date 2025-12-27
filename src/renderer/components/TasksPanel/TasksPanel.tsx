import { Button, Card, H5, Intent, Spinner, Text } from '@blueprintjs/core';
import '../../App.scss';
import { useTasks } from '../../contexts/TasksContext';

function TasksPanel() {
  const { tasks, cancelTask } = useTasks();

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div className="tasks-panel">
      {tasks.map((task) => (
        <Card key={task.id} elevation={2} className="task-card">
          <div className="task-header">
            <H5>{task.label}</H5>
            {task.status === 'RUNNING' && task.progress && (
              <Spinner size={16} value={task.progress} />
            )}
            {task.status === 'RUNNING' && !task.progress && <Spinner size={16} />}
            {task.status === 'COMPLETED' && <span className="task-status-icon completed">✓</span>}
            {task.status === 'FAILED' && <span className="task-status-icon failed">✗</span>}
            {task.status === 'CANCELED' && <span className="task-status-icon canceled">⊘</span>}
          </div>

          {task.error && (
            <Text className="task-error bp4-text-small bp4-text-muted">{task.error}</Text>
          )}

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
        </Card>
      ))}
    </div>
  );
}

export default TasksPanel;
