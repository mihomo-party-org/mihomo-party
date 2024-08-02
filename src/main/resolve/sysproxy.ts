import { triggerAutoProxy, triggerManualProxy } from '@mihomo-party/sysproxy'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { pacPort } from './server'

let defaultBypass: string[]
if (process.platform === 'linux')
  defaultBypass = ['localhost', '127.0.0.1', '192.168.0.0/16', '10.0.0.0/8', '172.16.0.0/12', '::1']
if (process.platform === 'darwin')
  defaultBypass = [
    '127.0.0.1',
    '192.168.0.0/16',
    '10.0.0.0/8',
    '172.16.0.0/12',
    'localhost',
    '*.local',
    '*.crashlytics.com',
    '<local>'
  ]
if (process.platform === 'win32')
  defaultBypass = [
    'localhost',
    '127.*',
    '192.168.*',
    '10.*',
    '172.16.*',
    '172.17.*',
    '172.18.*',
    '172.19.*',
    '172.20.*',
    '172.21.*',
    '172.22.*',
    '172.23.*',
    '172.24.*',
    '172.25.*',
    '172.26.*',
    '172.27.*',
    '172.28.*',
    '172.29.*',
    '172.30.*',
    '172.31.*',
    '<local>'
  ]

export function triggerSysProxy(enable: boolean): void {
  if (enable) {
    disableSysProxy()
    enableSysProxy()
  } else {
    disableSysProxy()
  }
}

export function enableSysProxy(): void {
  const { sysProxy } = getAppConfig()
  const { mode, host, bypass = defaultBypass } = sysProxy
  const { 'mixed-port': port = 7890 } = getControledMihomoConfig()

  switch (mode || 'manual') {
    case 'auto': {
      triggerAutoProxy(true, `http://${host || '127.0.0.1'}:${pacPort}/pac`)
      break
    }

    case 'manual': {
      triggerManualProxy(
        true,
        host || '127.0.0.1',
        port,
        bypass.join(process.platform === 'win32' ? ';' : ',')
      )
      break
    }
  }
}

export function disableSysProxy(): void {
  triggerAutoProxy(false, '')
  triggerManualProxy(false, '', 0, '')
}
