import { exec } from 'child_process'
import { app } from 'electron'
import fs from 'fs'

// 获取应用的可执行文件路径
const exePath = app.getPath('exe')

const appName = 'mihomo-party'

const taskXml = `
   <Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
     <RegistrationInfo>
       <Date>${new Date().toISOString()}</Date>
       <Author>${process.env.USERNAME}</Author>
     </RegistrationInfo>
     <Triggers>
       <LogonTrigger>
         <Enabled>true</Enabled>
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
       <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
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
         <Command>${exePath}</Command>
       </Exec>
     </Actions>
   </Task>
 `

export async function checkAutoRun(): Promise<boolean> {
  if (process.platform === 'win32') {
    const { stdout } = (await new Promise((resolve) => {
      exec(`schtasks /query /tn "${appName}"`, (_err, stdout, stderr) => {
        resolve({ stdout, stderr })
      })
    })) as { stdout: string; stderr: string }
    return stdout.includes(appName)
  }

  if (process.platform === 'darwin') {
    return app.getLoginItemSettings().openAtLogin
  }

  if (process.platform === 'linux') {
    return fs.existsSync(`${app.getPath('home')}/.config/autostart/${appName}.desktop`)
  }
  return false
}

export function enableAutoRun(): void {
  if (process.platform === 'win32') {
    const taskFilePath = `${app.getPath('userData')}\\${appName}.xml`
    fs.writeFileSync(taskFilePath, taskXml)
    exec(`schtasks /create /tn "${appName}" /xml "${taskFilePath}" /f`)
  }
  if (process.platform === 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: exePath
    })
  }
  if (process.platform === 'linux') {
    let desktop = `
[Desktop Entry]
Name=mihomo-party
Exec=${exePath} %U
Terminal=false
Type=Application
Icon=mihomo-party
StartupWMClass=mihomo-party
Comment=Mihomo Party
Categories=Utility;
`
    try {
      if (fs.existsSync(`/usr/share/applications/${appName}.desktop`)) {
        desktop = fs.readFileSync(`/usr/share/applications/${appName}.desktop`, 'utf8')
      }
    } catch (e) {
      console.error(e)
    }
    fs.mkdirSync(`${app.getPath('home')}/.config/autostart`, { recursive: true })
    const desktopFilePath = `${app.getPath('home')}/.config/autostart/${appName}.desktop`
    fs.writeFileSync(desktopFilePath, desktop)
  }
}

export function disableAutoRun(): void {
  if (process.platform === 'win32') {
    exec(`schtasks /delete /tn "${appName}" /f`)
  }
  if (process.platform === 'darwin') {
    app.setLoginItemSettings({
      openAtLogin: false
    })
  }
  if (process.platform === 'linux') {
    const desktopFilePath = `${app.getPath('home')}/.config/autostart/${appName}.desktop`
    fs.rmSync(desktopFilePath)
  }
}
