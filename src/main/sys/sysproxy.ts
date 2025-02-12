import { triggerAutoProxy, triggerManualProxy } from '@mihomo-party/sysproxy'
import { getAppConfig, getControledMihomoConfig } from '../config'
import { pacPort, startPacServer, stopPacServer } from '../resolve/server'
import { promisify } from 'util'
import { execFile } from 'child_process'
import path from 'path'
import { resourcesFilesDir } from '../utils/dirs'
import { net } from 'electron'
import axios from 'axios'

let defaultBypass: string[]
let triggerSysProxyTimer: NodeJS.Timeout | null = null
const helperSocketPath = '/tmp/mihomo-party-helper.sock'

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

export async function triggerSysProxy(enable: boolean): Promise<void> {
  if (net.isOnline()) {
    if (enable) {
      await disableSysProxy()
      await enableSysProxy()
    } else {
      await disableSysProxy()
    }
  } else {
    if (triggerSysProxyTimer) clearTimeout(triggerSysProxyTimer)
    triggerSysProxyTimer = setTimeout(() => triggerSysProxy(enable), 5000)
  }
}

async function enableSysProxy(): Promise<void> {
  await startPacServer()
  const { sysProxy } = await getAppConfig()
  const { mode, host, bypass = defaultBypass } = sysProxy
  const { 'mixed-port': port = 7890 } = await getControledMihomoConfig()
  const execFilePromise = promisify(execFile)
  switch (mode || 'manual') {
    case 'auto': {
      if (process.platform === 'win32') {
        try {
          await execFilePromise(path.join(resourcesFilesDir(), 'sysproxy.exe'), [
            'pac',
            `http://${host || '127.0.0.1'}:${pacPort}/pac`
          ])
        } catch {
          triggerAutoProxy(true, `http://${host || '127.0.0.1'}:${pacPort}/pac`)
        }
      } else if (process.platform === 'darwin') {
        await axios.post(
          'http://localhost/pac',
          { url: `http://${host || '127.0.0.1'}:${pacPort}/pac` },
          {
            socketPath: helperSocketPath
          }
        )
      } else {
        triggerAutoProxy(true, `http://${host || '127.0.0.1'}:${pacPort}/pac`)
      }

      break
    }

    case 'manual': {
      if (process.platform === 'win32') {
        try {
          await execFilePromise(path.join(resourcesFilesDir(), 'sysproxy.exe'), [
            'global',
            `${host || '127.0.0.1'}:${port}`,
            bypass.join(';')
          ])
        } catch {
          triggerManualProxy(true, host || '127.0.0.1', port, bypass.join(','))
        }
      } else if (process.platform === 'darwin') {
        await axios.post(
          'http://localhost/global',
          { host: host || '127.0.0.1', port: port.toString(), bypass: bypass.join(',') },
          {
            socketPath: helperSocketPath
          }
        )
      } else {
        triggerManualProxy(true, host || '127.0.0.1', port, bypass.join(','))
      }
      break
    }
  }
}

async function disableSysProxy(): Promise<void> {
  await stopPacServer()
  const execFilePromise = promisify(execFile)
  if (process.platform === 'win32') {
    try {
      await execFilePromise(path.join(resourcesFilesDir(), 'sysproxy.exe'), ['set', '1'])
    } catch {
      triggerAutoProxy(false, '')
      triggerManualProxy(false, '', 0, '')
    }
  } else if (process.platform === 'darwin') {
    await axios.get('http://localhost/off', {
      socketPath: helperSocketPath
    })
  } else {
    triggerAutoProxy(false, '')
    triggerManualProxy(false, '', 0, '')
  }
}
