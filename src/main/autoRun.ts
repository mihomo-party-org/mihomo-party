import { exec } from 'child_process'
import { app } from 'electron'
import fs from 'fs'

// 获取应用的可执行文件路径
const exePath = app.getPath('exe')

const taskName = 'mihomo-party'

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
      exec(`schtasks /query /tn "${taskName}"`, (_err, stdout, stderr) => {
        resolve({ stdout, stderr })
      })
    })) as { stdout: string; stderr: string }
    return stdout.includes(taskName)
  } else {
    return app.getLoginItemSettings().openAtLogin
  }
}

export function enableAutoRun(): void {
  if (process.platform === 'win32') {
    const taskFilePath = `${app.getPath('userData')}\\${taskName}.xml`
    fs.writeFileSync(taskFilePath, taskXml)
    exec(`schtasks /create /tn "${taskName}" /xml "${taskFilePath}" /f`)
  } else {
    app.setLoginItemSettings({
      openAtLogin: true,
      path: exePath
    })
  }
}

export function disableAutoRun(): void {
  if (process.platform === 'win32') {
    exec(`schtasks /delete /tn "${taskName}" /f`)
    app.setLoginItemSettings({
      openAtLogin: false
    })
  } else {
    app.setLoginItemSettings({
      openAtLogin: false
    })
  }
}
