import { describe, it, expect, vi } from 'vitest'
import { WriteQueue, KeyedWriteQueue } from './safeFile'

const tick = (ms = 0): Promise<void> => new Promise((r) => setTimeout(r, ms))

describe('WriteQueue', () => {
  it('serializes tasks in order and survives a failed task', async () => {
    const q = new WriteQueue()
    const log: string[] = []
    const a = q.run(async () => {
      await tick(10)
      log.push('a')
      throw new Error('a failed')
    })
    const b = q.run(async () => {
      log.push('b')
      return 'b'
    })
    await expect(a).rejects.toThrow('a failed')
    expect(await b).toBe('b')
    expect(log).toEqual(['a', 'b'])
  })

  it('rejects a waiter whose signal aborts before it reaches the task, keeping order', async () => {
    const q = new WriteQueue()
    const log: string[] = []
    let releaseA!: () => void
    const a = q.run(
      () =>
        new Promise<void>((r) => {
          releaseA = (): void => {
            log.push('a')
            r()
          }
        })
    )
    const ac = new AbortController()
    const b = q.run(async () => {
      log.push('b')
    }, ac.signal)
    const c = q.run(async () => {
      log.push('c')
    })
    ac.abort(new Error('budget exhausted'))
    await expect(b).rejects.toThrow('budget exhausted')
    // c must still wait for a: nothing has run yet
    await tick(5)
    expect(log).toEqual([])
    releaseA()
    await a
    await c
    expect(log).toEqual(['a', 'c'])
  })

  it('R2-ISS-029: an abort landing between the predecessor settling and the task starting still cancels', async () => {
    const q = new WriteQueue()
    const ac = new AbortController()
    const task = vi.fn(async () => 'ran')
    const r = q.run(task, ac.signal)
    await Promise.resolve() // waitFor(prev) has resolved; the task has not started yet
    ac.abort()
    await expect(r).rejects.toMatchObject({ name: 'AbortError' })
    expect(task).not.toHaveBeenCalled()
  })

  it('rejects immediately when the signal is already aborted', async () => {
    const q = new WriteQueue()
    const ac = new AbortController()
    ac.abort()
    await expect(q.run(async () => 1, ac.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('KeyedWriteQueue', () => {
  it('serializes per key and runs different keys concurrently', async () => {
    const q = new KeyedWriteQueue()
    const log: string[] = []
    const a1 = q.run('a', async () => {
      await tick(20)
      log.push('a1')
    })
    const b1 = q.run('b', async () => {
      log.push('b1')
    })
    const a2 = q.run('a', async () => {
      log.push('a2')
    })
    await Promise.all([a1, b1, a2])
    expect(log).toEqual(['b1', 'a1', 'a2'])
  })

  it('drops a key once idle', async () => {
    const q = new KeyedWriteQueue()
    expect(q.isIdle('k')).toBe(true)
    const p = q.run('k', async () => tick(5))
    expect(q.isIdle('k')).toBe(false)
    await p
    expect(q.isIdle('k')).toBe(true)
  })
})
