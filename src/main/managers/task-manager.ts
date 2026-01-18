import { BrowserWindow } from 'electron';
import log from 'electron-log';
import PQueue from 'p-queue';
import { v4 } from 'uuid';
import { MainIpcCallbacks, MainIpcGetter, TaskUpdateType } from '../../shared/constants';

let window: BrowserWindow | undefined;
let queue: PQueue;
let tasks: Map<string, Task>;
let updateClient: (type: TaskUpdateType, tasks: TaskMetadata[]) => void;

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

function emitUpdate(id: string) {
  const task = tasks.get(id);
  if (!task || !window) {
    return;
  }
  updateClient(TaskUpdateType.Update, [task]);
}

function emitAdded(id: string) {
  const task = tasks.get(id);
  if (!task || !window) {
    return;
  }
  updateClient(TaskUpdateType.Added, [task]);
}

function emitTasks() {
  const task = getActiveTasks();
  if (!task || !window) {
    return;
  }
  updateClient(TaskUpdateType.Structure, task);
}

function emitEnded(id: string) {
  const task = tasks.get(id);
  if (!task || !window) {
    return;
  }
  updateClient(TaskUpdateType.Ended, [task]);
}

export function addTask<T>(
  label: string,
  taskFn: (signal: AbortSignal, progress: ProgressReporter) => Promise<T>,
  options?: {
    timeout?: number;
    signal?: AbortSignal;
    userData?: any;
  } & TaskMetadata['options'],
): Promise<T> {
  const id = v4();
  const abortController = new AbortController();

  const task: Task = {
    id,
    label,
    progress: 0,
    status: 'PENDING',
    abortController,
    options: {
      blocking: options?.blocking,
      icon: options?.icon,
      silent: options?.silent,
    },
    userData: options?.userData,
    hash: 0,
  };

  tasks.set(id, task);

  const abortSignal = options?.signal
    ? AbortSignal.any([abortController.signal, options?.signal])
    : abortController.signal;

  return queue.add(
    async () => {
      if (task.status === 'CANCELED') {
        return Promise.reject(new Error('Task canceled'));
      }

      task.status = 'RUNNING';
      emitAdded(id);
      emitUpdate(id);
      let dirty = false;
      const interval = setInterval(() => {
        if (dirty) {
          emitUpdate(id);
        }
      }, 300);

      try {
        const report = (p: number) => {
          task.progress = p;
          dirty = true;
        };

        const result = await taskFn(abortSignal, report);
        task.status = 'COMPLETED';
        emitEnded(id);
        return result;
      } catch (error: any) {
        if (error.name === 'AbortError' || (task.status as string) === 'CANCELED') {
          task.status = 'CANCELED';
        } else {
          task.status = 'FAILED';
          task.error = error.message;
        }
        emitUpdate(id);
        throw error;
      } finally {
        tasks.delete(id);
        interval.close();
      }
    },
    { signal: abortSignal, id, timeout: options?.timeout },
  );
}

export function cancelTasks(selector: (t: Task) => boolean) {
  const toCancel: Task[] = Array.from(tasks.values()).filter(selector);

  toCancel.forEach((t) => {
    t.abortController?.abort();
    tasks.delete(t.id);
  });
}

function cancelTask(taskIdRaw: string) {
  const id = taskIdRaw.toString();
  const task = tasks.get(id);
  if (task && task.status !== 'COMPLETED' && task.status !== 'FAILED') {
    task.status = 'CANCELED';
    task.abortController?.abort();
  }
}

export function InitializeTasks(win: BrowserWindow) {
  window = win;
}

export function InitializeTasksApi(api: MainIpcGetter, apiCallbacks: MainIpcCallbacks) {
  queue = new PQueue();
  queue.on('add', emitTasks);
  queue.on('next', emitTasks);
  queue.on('error', (e) => log.error(e));
  tasks = new Map();

  api.getTasks = () => Promise.resolve(getActiveTasks());
  api.cancelTask = async (taskId: string) => cancelTask(taskId);
  updateClient = apiCallbacks.onTasksUpdate;
}
