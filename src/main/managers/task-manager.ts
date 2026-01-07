import { BrowserWindow } from 'electron';
import PQueue from 'p-queue';
import { v4 } from 'uuid';
import { MainIpcCallbacks, MainIpcGetter } from '../../shared/constants';

let window: BrowserWindow | undefined;
let queue: PQueue;
let tasks: Map<string, Task>;
let updateClient: (tasks: TaskMetadata[]) => void;

function getActiveTasks(): TaskMetadata[] {
  return Array.from<TaskMetadata>(tasks.values()).map<TaskMetadata>((task) => {
    const meta: TaskMetadata = {
      id: task.id,
      label: task.label,
      status: task.status,
      progress: task.progress,
      error: task.error,
      options: task.options,
    };
    return meta;
  });
}

function emitUpdate() {
  const activeTasks = getActiveTasks();
  if (!window) {
    return;
  }
  updateClient(activeTasks);
}

export function addTask<T>(
  label: string,
  taskFn: (signal: AbortSignal, progress: ProgressReporter) => Promise<T>,
  options?: TaskMetadata['options'],
  userData?: any,
): Promise<T> {
  const id = v4();
  const abortController = new AbortController();

  const task: Task = {
    id,
    label,
    progress: 0,
    status: 'PENDING',
    abortController,
    options: options ?? { blocking: false },
    userData,
  };

  tasks.set(id, task);
  emitUpdate();

  return queue.add(async () => {
    if (task.status === 'CANCELED') {
      throw new Error('Task canceled');
    }

    task.status = 'RUNNING';
    emitUpdate();

    try {
      const report = (p: number) => {
        task.progress = p;
        emitUpdate();
      };
      const result = await taskFn(abortController.signal, report);
      task.status = 'COMPLETED';
      emitUpdate();
      return result;
    } catch (error: any) {
      if (error.name === 'AbortError' || (task.status as string) === 'CANCELED') {
        task.status = 'CANCELED';
      } else {
        task.status = 'FAILED';
        task.error = error.message;
      }
      throw error;
    } finally {
      emitUpdate();
      // Cleanup after a delay to let the UI show the final state
      setTimeout(() => {
        tasks.delete(id);
        emitUpdate();
      }, 5000);
    }
  });
}

export function cancelTasks(selector: (t: Task) => boolean) {
  const toCancel: Task[] = Array.from(tasks.values()).filter(selector);

  toCancel.forEach((t) => {
    t.abortController?.abort();
    tasks.delete(t.id);
  });
  emitUpdate();
}

function cancelTask(taskIdRaw: string) {
  const id = taskIdRaw.toString();
  const task = tasks.get(id);
  if (task && task.status !== 'COMPLETED' && task.status !== 'FAILED') {
    task.status = 'CANCELED';
    task.abortController?.abort();
    emitUpdate();
  }
}

export function InitializeTasks(win: BrowserWindow) {
  window = win;
}

export function InitializeTasksApi(api: MainIpcGetter, apiCallbacks: MainIpcCallbacks) {
  queue = new PQueue({ concurrency: 2 });
  tasks = new Map();

  api.getTasks = () => Promise.resolve(getActiveTasks());
  api.cancelTask = async (taskId: string) => cancelTask(taskId);
  updateClient = apiCallbacks.onTasksUpdate;
}
