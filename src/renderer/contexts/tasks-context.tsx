import React, { createContext, useContext, useEffect, useState } from 'react';

export interface Task {
  id: string;
  label: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  error?: string;
}

interface TasksContextType {
  tasks: Task[];
  cancelTask: (id: string) => void;
}

const TasksContext = createContext<TasksContextType | undefined>(undefined);

export const TasksProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    // Listen for task updates
    const removeListener = window.api.on(
      'TASK_UPDATED',
      (_event: any, ...args: unknown[]) => {
        const updatedTasks = args[0] as Task[];
        setTasks(updatedTasks);
      }
    );

    // Load initial tasks
    window.api.invoke('TASKS_GET_ACTIVE').then((initialTasks: unknown) => {
      setTasks(initialTasks as Task[]);
    });

    return () => {
      removeListener();
    };
  }, []);

  const cancelTask = (id: string) => {
    window.api.invoke('TASKS_CANCEL', id);
  };

  return (
    <TasksContext.Provider value={{ tasks, cancelTask }}>
      {children}
    </TasksContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TasksContext);
  if (context === undefined) {
    throw new Error('useTasks must be used within a TasksProvider');
  }
  return context;
};
