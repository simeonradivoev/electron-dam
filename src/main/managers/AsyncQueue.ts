const MAX_QUEUE = 500;

export default class AsyncQueue {
  private running = 0;
  private queue: (() => Promise<void>)[] = [];

  constructor(private readonly maxConcurrent: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    if (this.queue.length > MAX_QUEUE) {
      return Promise.reject(new Error('Queue overflow'));
    }
    return new Promise<T>((resolve, reject) => {
      const wrapped = async () => {
        try {
          this.running++;
          resolve(await task());
        } catch (e) {
          reject(e);
        } finally {
          this.running--;
          this.next();
        }
      };

      this.queue.push(wrapped);
      this.next();
    });
  }

  private next() {
    if (this.running >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const task = this.queue.shift()!;
    task();
  }
}
