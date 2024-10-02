import axios from 'axios'
import yaml from 'yaml'
import { app, shell } from 'electron'
import { getControledMihomoConfig } from '../config'
import { dataDir, exeDir, exePath, isPortable, resourcesFilesDir } from '../utils/dirs'
import { rm, writeFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import os from 'os'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'

export async function checkUpdate(): Promise<IAppVersion | undefined> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const res = await axios.get(
    'https://github.com/mihomo-party-org/mihomo-party/releases/latest/download/latest.yml',
    {
      headers: { 'Content-Type': 'application/octet-stream' },
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port: mixedPort
      }
    }
  )
  const latest = yaml.parse(res.data, { merge: true }) as IAppVersion
  const currentVersion = app.getVersion()
  if (latest.version !== currentVersion) {
    return latest
  } else {
    return undefined
  }
}

export async function downloadAndInstallUpdate(version: string): Promise<void> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const baseUrl = `https://github.com/mihomo-party-org/mihomo-party/releases/download/v${version}/`
  const fileMap = {
    'win32-x64': `mihomo-party-windows-${version}-x64-setup.exe`,
    'win32-ia32': `mihomo-party-windows-${version}-ia32-setup.exe`,
    'win32-arm64': `mihomo-party-windows-${version}-arm64-setup.exe`,
    'darwin-x64': `mihomo-party-macos-${version}-x64.dmg`,
    'darwin-arm64': `mihomo-party-macos-${version}-arm64.dmg`
  }
  let file = fileMap[`${process.platform}-${process.arch}`]
  if (isPortable()) {
    file = file.replace('-setup.exe', '-portable.7z')
  }
  if (!file) {
    throw new Error('不支持自动更新，请手动下载更新')
  }
  if (process.platform === 'win32' && parseInt(os.release()) < 10) {
    file = file.replace('windows', 'win7')
  }
  try {
    if (!existsSync(path.join(dataDir(), file))) {
      const res = await axios.get(`${baseUrl}${file}`, {
        responseType: 'arraybuffer',
        proxy: {
          protocol: 'http',
          host: '127.0.0.1',
          port: mixedPort
        },
        headers: {
          'Content-Type': 'application/octet-stream'
        }
      })
      await writeFile(path.join(dataDir(), file), res.data)
    }
    if (file.endsWith('.exe')) {
      spawn(path.join(dataDir(), file), ['/S', '--force-run'], {
        detached: true,
        stdio: 'ignore'
      }).unref()
    }
    if (file.endsWith('.7z')) {
      spawn(
        'cmd',
        [
          '/C',
          `""${path.join(resourcesFilesDir(), '7za.exe')}" x -o"${exeDir()}" -y "${path.join(dataDir(), file)}" & start "" "${exePath()}""`
        ],
        {
          shell: true,
          detached: true
        }
      ).unref()
      app.quit()
    }
    if (file.endsWith('.dmg')) {
      try {
        const execPromise = promisify(exec)
        const name = exePath().split('.app')[0].replace('/Applications/', '')
        await execPromise(
          `hdiutil attach "${path.join(dataDir(), file)}" -mountpoint "/Volumes/mihomo-party" -nobrowse`
        )
        try {
          await execPromise(`mv /Applications/${name}.app /tmp`)
          await execPromise('cp -R "/Volumes/mihomo-party/Mihomo Party.app" /Applications/')
          await execPromise(`rm -rf /tmp/${name}.app`)
        } catch (e) {
          await execPromise(`mv /tmp/${name}.app /Applications`)
          throw e
        } finally {
          await execPromise('hdiutil detach "/Volumes/mihomo-party"')
        }
        app.relaunch()
        app.quit()
      } catch {
        shell.openPath(path.join(dataDir(), file))
      }
    }
  } catch (e) {
    rm(path.join(dataDir(), file))
    throw e
  }
}
