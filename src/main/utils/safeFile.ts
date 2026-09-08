import { randomBytes } from 'crypto'
import { closeSync, fsyncSync, openSync, renameSync, rmSync, writeFileSync } from 'fs'
import { open, rename, rm, type FileHandle } from 'fs/promises'
import { basename, dirname, join } from 'path'

export interface AtomicWriteOptions {
  encoding?: BufferEncoding
  mode?: number
}

function temporaryPath(filePath: string): string {
  return join(
    dirname(filePath),
    `.${basename(filePath)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`
  )
}

/**
 * Write a complete replacement beside the existing file, then atomically rename it into place.
 * A failed write never truncates the previous file.
 */
export async function atomicWriteFile(
  filePath: string,
  data: string | Uint8Array,
  options: AtomicWriteOptions = {}
): Promise<void> {
  const tempPath = temporaryPath(filePath)
  let handle: FileHandle | undefined

  try {
    handle = await open(tempPath, 'wx', options.mode)
    await handle.writeFile(data, options.encoding ?? 'utf8')
    await handle.sync()
    await handle.close()
    handle = undefined
    await rename(tempPath, filePath)
  } finally {
    if (handle) await handle.close().catch(() => {})
    await rm(tempPath, { force: true }).catch(() => {})
  }
}

export function atomicWriteFileSync(
  filePath: string,
  data: string | Uint8Array,
  options: AtomicWriteOptions = {}
): void {
  const tempPath = temporaryPath(filePath)
  let fd: number | undefined

  try {
    fd = openSync(tempPath, 'wx', options.mode)
    writeFileSync(fd, data, options.encoding ?? 'utf8')
    fsyncSync(fd)
    closeSync(fd)
    fd = undefined
    renameSync(tempPath, filePath)
  } finally {
    if (fd !== undefined) {
      try {
        closeSync(fd)
      } catch {
        // Best effort cleanup after the original write error.
      }
    }
    try {
      rmSync(tempPath, { force: true })
    } catch {
      // Best effort cleanup after the original write error.
    }
  }
}

function abortError(signal: AbortSignal): Error {
  const reason = signal.reason
  if (reason instanceof Error) return reason
  const err = new Error('The operation was aborted') as Error & { code?: string }
  err.name = 'AbortError'
  err.code = 'ABORT_ERR'
  return err
}

// Resolves when `p` settles; rejects early if `signal` aborts while still waiting.
function waitFor(p: Promise<void>, signal?: AbortSignal): Promise<void> {
  if (!signal) return p
  if (signal.aborted) return Promise.reject(abortError(signal))
  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => reject(abortError(signal))
    signal.addEventListener('abort', onAbort, { once: true })
    p.then(
      () => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      },
      () => {
        signal.removeEventListener('abort', onAbort)
        resolve()
      }
    )
  })
}

const noop = (): void => undefined

/**
 * Keeps writes serialized without allowing one failed write to block later retries.
 * A waiter may hand in an AbortSignal: if it fires before the queue reaches the task,
 * the task never runs and the caller gets the abort reason; the queue order is preserved.
 */
export class WriteQueue {
  private tail: Promise<void> = Promise.resolve()

  run<T>(task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    const prev = this.tail
    // waitFor 的 resolve 与 task 启动之间可能插入一次 abort（微任务间隙）：启动前再检查一次
    const current = waitFor(prev, signal).then(() => {
      if (signal?.aborted) throw abortError(signal)
      return task()
    })
    // Successors wait for both the previous holder and this task, even when this waiter aborted.
    this.tail = current.then(noop, noop).then(() => prev)
    return current
  }
}

/** One WriteQueue per key; a queue is dropped once nothing is pending on it. */
export class KeyedWriteQueue {
  private readonly queues = new Map<string, { queue: WriteQueue; pending: number }>()

  run<T>(key: string, task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
    let entry = this.queues.get(key)
    if (!entry) {
      entry = { queue: new WriteQueue(), pending: 0 }
      this.queues.set(key, entry)
    }
    const held = entry
    held.pending++
    return held.queue.run(task, signal).finally(() => {
      held.pending--
      if (held.pending === 0 && this.queues.get(key) === held) this.queues.delete(key)
    })
  }

  isIdle(key: string): boolean {
    return !this.queues.has(key)
  }
}
