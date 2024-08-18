import axios from 'axios'
import yaml from 'yaml'
import { app, shell } from 'electron'
import { getControledMihomoConfig } from '../config'
import { dataDir, isPortable } from '../utils/dirs'
import { rm, writeFile } from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'

export async function checkUpdate(): Promise<IAppVersion | undefined> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const res = await axios.get(
    'https://github.com/pompurin404/mihomo-party/releases/latest/download/latest.yml',
    {
      headers: { 'Content-Type': 'application/octet-stream' },
      proxy: {
        protocol: 'http',
        host: '127.0.0.1',
        port: mixedPort
      }
    }
  )
  const latest = yaml.parse(res.data) as IAppVersion
  const currentVersion = app.getVersion()
  if (latest.version !== currentVersion) {
    return latest
  } else {
    return undefined
  }
}

export async function downloadAndInstallUpdate(version: string): Promise<void> {
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const baseUrl = `https://github.com/pompurin404/mihomo-party/releases/download/v${version}/`
  const fileMap = {
    'win32-x64': `mihomo-party-windows-${version}-x64-setup.exe`,
    'win32-ia32': `mihomo-party-windows-${version}-ia32-setup.exe`,
    'win32-arm64': `mihomo-party-windows-${version}-arm64-setup.exe`,
    'darwin-x64': `mihomo-party-macos-${version}-x64.dmg`,
    'darwin-arm64': `mihomo-party-macos-${version}-arm64.dmg`
  }
  const file = fileMap[`${process.platform}-${process.arch}`]
  if (isPortable()) {
    throw new Error('便携模式不支持自动更新')
  }
  if (!file) {
    throw new Error('不支持自动更新，请手动下载更新')
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
    await shell.openPath(path.join(dataDir(), file))
    app.quit()
  } catch (e) {
    rm(path.join(dataDir(), file))
    throw e
  }
}
