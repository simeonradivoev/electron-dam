import React from 'react';
import { Button, Card, H5, Intent, Spinner, Text } from '@blueprintjs/core';
import { useTasks } from '../../contexts/tasks-context';

const TasksPanel: React.FC = () => {
  const { tasks, cancelTask } = useTasks();

  if (tasks.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '300px',
        zIndex: 1000,
        maxHeight: '400px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      {tasks.map((task) => (
        <Card key={task.id} elevation={2} style={{ padding: '10px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '5px',
            }}
          >
            <H5 style={{ margin: 0, fontSize: '14px' }}>{task.label}</H5>
            {task.status === 'RUNNING' && <Spinner size={16} />}
            {task.status === 'COMPLETED' && (
              <span style={{ color: 'green' }}>✓</span>
            )}
            {task.status === 'FAILED' && (
              <span style={{ color: 'red' }}>✗</span>
            )}
            {task.status === 'CANCELED' && (
              <span style={{ color: 'orange' }}>⊘</span>
            )}
          </div>

          {task.error && (
            <Text
              className="bp4-text-small bp4-text-muted"
              style={{ color: '#d9822b', marginBottom: '5px' }}
            >
              {task.error}
            </Text>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
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
};

export default TasksPanel;
