import { getAppConfig } from '../../config/app'
import { MAX_PLUGIN_FILE_BYTES } from './constants'
import { requestOnce, type PluginProxy } from './http-client'
import { createGuardedLookup, isForbiddenHost } from './net-guard'
import { resolveLocalProxy } from './route'

function parseDownloadUrl(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Invalid plugin URL')
  }
  if (parsed.protocol !== 'https:') throw new Error('Plugin URL must use https')
  if (parsed.username || parsed.password) throw new Error('Plugin URL must not contain userinfo')
  if (parsed.hash) throw new Error('Plugin URL must not contain a fragment')
  if (isForbiddenHost(parsed.hostname)) throw new Error('Plugin URL must use a public host')
  return parsed
}

export async function fetchRemotePlugin(url: string): Promise<string> {
  const parsed = parseDownloadUrl(url)
  const { subscriptionTimeout = 30000, pluginUseProxy } = await getAppConfig()
  // 与插件请求同一套本地代理解析：端口校验（混合端口关闭 → 代理不可用）与核心 inbound 认证凭据
  let proxy: PluginProxy | undefined
  if (pluginUseProxy) proxy = await resolveLocalProxy()

  const response = await requestOnce(parsed.toString(), {
    method: 'GET',
    headers: { Accept: 'application/json, application/octet-stream' },
    timeout: subscriptionTimeout,
    maxBytes: MAX_PLUGIN_FILE_BYTES,
    lookup: createGuardedLookup(),
    proxy
  })
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Plugin download failed (status ${response.status})`)
  }
  return Buffer.from(response.body, 'utf-8').toString('base64')
}
