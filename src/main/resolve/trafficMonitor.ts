import { ChildProcess, spawn } from 'child_process'
import { getAppConfig } from '../config'
import { resourcesFilesDir } from '../utils/dirs'
import path from 'path'

let child: ChildProcess

export async function startMonitor(detached = false): Promise<void> {
  if (process.platform !== 'win32') return
  await stopMonitor()
  const { showTraffic = true } = await getAppConfig()
  if (!showTraffic) return
  child = spawn(path.join(resourcesFilesDir(), 'TrafficMonitor/TrafficMonitor.exe'), [], {
    cwd: path.join(resourcesFilesDir(), 'TrafficMonitor'),
    detached: detached,
    stdio: detached ? 'ignore' : undefined
  })
  if (detached) {
    child.unref()
  }
}

async function stopMonitor(): Promise<void> {
  if (child) {
    child.kill('SIGINT')
  }
}
