import { getAppConfig } from '../config'
import dayjs from 'dayjs'
import AdmZip from 'adm-zip'
import {
  appConfigPath,
  controledMihomoConfigPath,
  dataDir,
  overrideConfigPath,
  overrideDir,
  profileConfigPath,
  profilesDir
} from '../utils/dirs'

export async function webdavBackup(): Promise<boolean> {
  const webdav = await import('webdav')
  const createClient = webdav.createClient
  const { webdavUrl = '', webdavUsername = '', webdavPassword = '' } = await getAppConfig()
  const zip = new AdmZip()

  zip.addLocalFile(appConfigPath())
  zip.addLocalFile(controledMihomoConfigPath())
  zip.addLocalFile(profileConfigPath())
  zip.addLocalFile(overrideConfigPath())
  zip.addLocalFolder(profilesDir(), 'profiles')
  zip.addLocalFolder(overrideDir(), 'override')
  const date = new Date()
  const zipFileName = `${process.platform}_${dayjs(date).format('YYYY-MM-DD_HH-mm-ss')}.zip`

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword
  })
  try {
    await client.createDirectory('mihomo-party')
  } catch {
    // ignore
  }

  return await client.putFileContents(`mihomo-party/${zipFileName}`, zip.toBuffer())
}

export async function webdavRestore(filename: string): Promise<void> {
  const webdav = await import('webdav')
  const createClient = webdav.createClient
  const { webdavUrl = '', webdavUsername = '', webdavPassword = '' } = await getAppConfig()

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword
  })
  const zipData = await client.getFileContents(`mihomo-party/${filename}`)
  const zip = new AdmZip(zipData as Buffer)
  zip.extractAllTo(dataDir(), true)
}

export async function listWebdavBackups(): Promise<string[]> {
  const webdav = await import('webdav')
  const createClient = webdav.createClient
  const { webdavUrl = '', webdavUsername = '', webdavPassword = '' } = await getAppConfig()

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword
  })
  const files = await client.getDirectoryContents('mihomo-party', { glob: '*.zip' })
  if (Array.isArray(files)) {
    return files.map((file) => file.basename)
  } else {
    return files.data.map((file) => file.basename)
  }
}

export async function webdavDelete(filename: string): Promise<void> {
  const webdav = await import('webdav')
  const createClient = webdav.createClient
  const { webdavUrl = '', webdavUsername = '', webdavPassword = '' } = await getAppConfig()

  const client = createClient(webdavUrl, {
    username: webdavUsername,
    password: webdavPassword
  })
  await client.deleteFile(`mihomo-party/${filename}`)
}
