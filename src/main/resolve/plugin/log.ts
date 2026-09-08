// 插件模块的惰性日志：只有真正需要写日志时才加载应用 logger（它依赖 electron），
// 单测环境下加载失败则静默忽略。
export async function warnLog(message: string, error?: unknown): Promise<void> {
  try {
    const { logger } = await import('../../utils/logger')
    await logger.warn(`[Plugin] ${message}`, error)
  } catch {
    // logging is best-effort
  }
}
