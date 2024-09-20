import { copyFile, readdir, readFile } from 'fs/promises'
import { themesDir } from '../utils/dirs'
import path from 'path'
import axios from 'axios'
import AdmZip from 'adm-zip'
import { getControledMihomoConfig } from '../config'
import { existsSync } from 'fs'
import { mainWindow } from '..'

let insertedCSSKey: string | undefined = undefined

export async function resolveThemes(): Promise<{ key: string; label: string }[]> {
  const files = await readdir(themesDir())
  const themes = await Promise.all(
    files.map(async (file) => {
      const css = (await readFile(path.join(themesDir(), file), 'utf-8')) || ''
      let name = file
      if (css.startsWith('/*')) {
        name = css.split('\n')[0].replace('/*', '').replace('*/', '').trim() || file
      }
      return { key: file, label: name }
    })
  )
  return [{ key: 'default.css', label: '默认' }, ...themes]
}

export async function fetchThemes(): Promise<void> {
  const zipUrl = 'https://github.com/mihomo-party-org/theme-hub/releases/download/latest/themes.zip'
  const { 'mixed-port': mixedPort = 7890 } = await getControledMihomoConfig()
  const zipData = await axios.get(zipUrl, {
    responseType: 'arraybuffer',
    headers: { 'Content-Type': 'application/octet-stream' },
    proxy: {
      protocol: 'http',
      host: '127.0.0.1',
      port: mixedPort
    }
  })
  const zip = new AdmZip(zipData.data as Buffer)
  zip.extractAllTo(themesDir(), true)
}

export async function importThemes(files: string[]): Promise<void> {
  for (const file of files) {
    if (existsSync(file)) await copyFile(file, path.join(themesDir(), path.basename(file)))
  }
}

export async function applyTheme(theme: string): Promise<void> {
  if (theme === 'default.css') {
    if (insertedCSSKey) {
      await mainWindow?.webContents.removeInsertedCSS(insertedCSSKey)
    }
    return
  }
  if (!existsSync(path.join(themesDir(), theme))) return
  const css = await readFile(path.join(themesDir(), theme), 'utf-8')
  if (insertedCSSKey) {
    await mainWindow?.webContents.removeInsertedCSS(insertedCSSKey)
  }
  insertedCSSKey = await mainWindow?.webContents.insertCSS(css)
}
