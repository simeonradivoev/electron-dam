import PQueue from 'p-queue';
import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { v4 as uuidv4 } from 'uuid';

export interface Task {
  id: string;
  label: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELED';
  error?: string;
  abortController?: AbortController;
}

export type TaskStatus = Task['status'];

class TaskManager {
  private queue: PQueue;

  private tasks: Map<string, Task>;

  constructor() {
    this.queue = new PQueue({ concurrency: 2 });
    this.tasks = new Map();
  }

  initialize() {
    this.setupIpc();
  }

  private setupIpc() {
    ipcMain.handle('TASKS_GET_ACTIVE', () => this.getActiveTasks());
    ipcMain.handle('TASKS_CANCEL', (_event, taskId: string) =>
      this.cancelTask(taskId)
    );
  }

  private getActiveTasks() {
    return Array.from(this.tasks.values()).map((task) => ({
      id: task.id,
      label: task.label,
      status: task.status,
      error: task.error,
    }));
  }

  private emitUpdate() {
    // We need a way to send updates to the renderer.
    // Since we don't have a direct reference to the window here,
    // we might need to accept a callback or use a global event emitter.
    // For now, we'll rely on the renderer polling or listening to a specific channel if we pass the window.
    // Ideally, we should use `BrowserWindow.getAllWindows().forEach(...)` or similar.
    const { BrowserWindow } = require('electron');
    BrowserWindow.getAllWindows().forEach((win: any) => {
      win.webContents.send('TASK_UPDATED', this.getActiveTasks());
    });
  }

  async addTask<T>(
    label: string,
    taskFn: (signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const id = uuidv4();
    const abortController = new AbortController();

    const task: Task = {
      id,
      label,
      status: 'PENDING',
      abortController,
    };

    this.tasks.set(id, task);
    this.emitUpdate();

    try {
      return await this.queue.add(async () => {
        if (task.status === 'CANCELED') {
          throw new Error('Task canceled');
        }

        task.status = 'RUNNING';
        this.emitUpdate();

        try {
          const result = await taskFn(abortController.signal);
          task.status = 'COMPLETED';
          return result;
        } catch (error: any) {
          if (
            error.name === 'AbortError' ||
            (task.status as string) === 'CANCELED'
          ) {
            task.status = 'CANCELED';
          } else {
            task.status = 'FAILED';
            task.error = error.message;
          }
          throw error;
        } finally {
          this.emitUpdate();
          // Cleanup after a delay to let the UI show the final state
          setTimeout(() => {
            this.tasks.delete(id);
            this.emitUpdate();
          }, 5000);
        }
      });
    } catch (error) {
      // Already handled in the queue callback, but we catch here to prevent unhandled rejections
      throw error;
    }
  }

  cancelTask(taskId: string) {
    const task = this.tasks.get(taskId);
    if (task && task.status !== 'COMPLETED' && task.status !== 'FAILED') {
      task.status = 'CANCELED';
      task.abortController?.abort();
      this.emitUpdate();
    }
  }
}

export const taskManager = new TaskManager();
export default TaskManager;
