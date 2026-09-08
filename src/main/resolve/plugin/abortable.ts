// op 内不受底层取消机制约束的等待（DNS 预检、代理配置读取、vault 解密）统一经此接收同一个 signal，并可按
// 网络余量限时（§0.4 规则 1：一个 op 一个 AbortSignal；网络阶段靠限时在 deadline 前 reserve 结束）。
// 被包装的 promise 本身不会被取消：中止后它继续跑到结束，结果被丢弃；调用方按 CPX_TIMEOUT 结束。
import { CPX_TIMEOUT, codedError } from './errors'

export function abortable<T>(p: Promise<T>, signal?: AbortSignal, timeoutMs?: number): Promise<T> {
  if (!signal && timeoutMs === undefined) return p
  const timeout = (): Error => codedError('Request timed out', CPX_TIMEOUT, 'pre-send')
  if (signal?.aborted) {
    // 已中止：不再等 p，但 p 的拒绝也要有人接住——同一个 signal 往往让底层等待（如锁排队）同时拒绝
    p.catch(() => {})
    return Promise.reject(timeout())
  }
  return new Promise<T>((resolve, reject) => {
    let timer: NodeJS.Timeout | undefined
    const cleanup = (): void => {
      signal?.removeEventListener('abort', onAbort)
      if (timer) clearTimeout(timer)
    }
    const onAbort = (): void => {
      cleanup()
      reject(timeout())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    if (timeoutMs !== undefined) timer = setTimeout(onAbort, Math.max(0, timeoutMs))
    p.then(
      (v) => {
        cleanup()
        resolve(v)
      },
      (e) => {
        cleanup()
        reject(e)
      }
    )
  })
}
