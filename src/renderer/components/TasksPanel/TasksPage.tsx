import React from 'react';
import { H2 } from '@blueprintjs/core';
import TasksPanel from './TasksPanel';

const TasksPage: React.FC = () => {
  return (
    <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
      <H2>Active Tasks</H2>
      <div style={{ maxWidth: '600px' }}>
        <TasksPanel />
      </div>
    </div>
  );
};

export default TasksPage;
