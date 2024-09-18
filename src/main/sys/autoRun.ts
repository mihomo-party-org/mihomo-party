import { taskDir, exePath, homeDir } from '../utils/dirs'
import { mkdir, readFile, rm, writeFile } from 'fs/promises'
import { exec } from 'child_process'
import { existsSync } from 'fs'
import { app } from 'electron'
import { promisify } from 'util'
import path from 'path'

const appName = 'mihomo-party'

const taskXml = `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Date>${new Date().toISOString()}</Date>
    <Author>${process.env.USERNAME}</Author>
  </RegistrationInfo>
  <Triggers>
    <LogonTrigger>
      <Enabled>true</Enabled>
      <Delay>PT3S</Delay>
    </LogonTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>HighestAvailable</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>false</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>true</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>false</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT0S</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${exePath()}</Command>
    </Exec>
  </Actions>
</Task>
 `

export async function checkAutoRun(): Promise<boolean> {
  if (process.platform === 'win32') {
    const execPromise = promisify(exec)
    try {
      const { stdout } = await execPromise(`schtasks /query /tn "${appName}"`)
      return stdout.includes(appName)
    } catch (e) {
      return false
    }
  }

  if (process.platform === 'darwin') {
    return app.getLoginItemSettings().openAtLogin
  }

  if (process.platform === 'linux') {
    return existsSync(path.join(homeDir, '.config', 'autostart', `${appName}.desktop`))
  }
  return false
}

export async function enableAutoRun(): Promise<void> {
  if (process.platform === 'win32') {
    const execPromise = promisify(exec)
    const taskFilePath = path.join(taskDir(), `${appName}.xml`)
    await writeFile(taskFilePath, Buffer.from(`\ufeff${taskXml}`, 'utf-16le'))
    await execPromise(`schtasks /create /tn "${appName}" /xml "${taskFilePath}" /f`)
  }
  if (process.platform === 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: true
    })
  }
  if (process.platform === 'linux') {
    let desktop = `
[Desktop Entry]
Name=mihomo-party
Exec=${exePath()} %U
Terminal=false
Type=Application
Icon=mihomo-party
StartupWMClass=mihomo-party
Comment=Mihomo Party
Categories=Utility;
`

    if (existsSync(`/usr/share/applications/${appName}.desktop`)) {
      desktop = await readFile(`/usr/share/applications/${appName}.desktop`, 'utf8')
    }
    const autostartDir = path.join(homeDir, '.config', 'autostart')
    if (!existsSync(autostartDir)) {
      await mkdir(autostartDir, { recursive: true })
    }
    const desktopFilePath = path.join(autostartDir, `${appName}.desktop`)
    await writeFile(desktopFilePath, desktop)
  }
}

export async function disableAutoRun(): Promise<void> {
  if (process.platform === 'win32') {
    const execPromise = promisify(exec)
    await execPromise(`schtasks /delete /tn "${appName}" /f`)
  }
  if (process.platform === 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: false
    })
  }
  if (process.platform === 'linux') {
    const desktopFilePath = path.join(homeDir, '.config', 'autostart', `${appName}.desktop`)
    await rm(desktopFilePath)
  }
}
