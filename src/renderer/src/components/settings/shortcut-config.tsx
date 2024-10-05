import { Button, Input } from '@nextui-org/react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import React, { KeyboardEvent, useState } from 'react'
import { platform } from '@renderer/utils/init'
import { registerShortcut } from '@renderer/utils/ipc'

const keyMap = {
  Backquote: '`',
  Backslash: '\\',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Equal: '=',
  Minus: '-',
  Plus: 'PLUS',
  Period: '.',
  Quote: "'",
  Semicolon: ';',
  Slash: '/',
  Backspace: 'Backspace',
  CapsLock: 'Capslock',
  ContextMenu: 'Contextmenu',
  Space: 'Space',
  Tab: 'Tab',
  Convert: 'Convert',
  Delete: 'Delete',
  End: 'End',
  Help: 'Help',
  Home: 'Home',
  PageDown: 'Pagedown',
  PageUp: 'Pageup',
  Escape: 'Esc',
  PrintScreen: 'Printscreen',
  ScrollLock: 'Scrolllock',
  Pause: 'Pause',
  Insert: 'Insert',
  Suspend: 'Suspend'
}

const ShortcutConfig: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    showWindowShortcut = '',
    showFloatingWindowShortcut = '',
    triggerSysProxyShortcut = '',
    triggerTunShortcut = '',
    ruleModeShortcut = '',
    globalModeShortcut = '',
    directModeShortcut = '',
    quitWithoutCoreShortcut = '',
    restartAppShortcut = ''
  } = appConfig || {}

  return (
    <SettingCard title="快捷键设置">
      <SettingItem title="打开/关闭窗口" divider>
        <div className="flex justify-end w-[60%]">
          <ShortcutInput
            value={showWindowShortcut}
            patchAppConfig={patchAppConfig}
            action="showWindowShortcut"
          />
        </div>
      </SettingItem>
      <SettingItem title="打开/关闭悬浮窗" divider>
        <div className="flex justify-end w-[60%]">
          <ShortcutInput
            value={showFloatingWindowShortcut}
            patchAppConfig={patchAppConfig}
            action="showFloatingWindowShortcut"
          />
        </div>
      </SettingItem>
      <SettingItem title="打开/关闭系统代理" divider>
        <div className="flex justify-end w-[60%]">
          <ShortcutInput
            value={triggerSysProxyShortcut}
            patchAppConfig={patchAppConfig}
            action="triggerSysProxyShortcut"
          />
        </div>
      </SettingItem>
      <SettingItem title="打开/关闭虚拟网卡" divider>
        <div className="flex justify-end w-[60%]">
          <ShortcutInput
            value={triggerTunShortcut}
            patchAppConfig={patchAppConfig}
            action="triggerTunShortcut"
          />
        </div>
      </SettingItem>
      <SettingItem title="切换规则模式" divider>
        <div className="flex justify-end w-[60%]">
          <ShortcutInput
            value={ruleModeShortcut}
            patchAppConfig={patchAppConfig}
            action="ruleModeShortcut"
          />
        </div>
      </SettingItem>
      <SettingItem title="切换全局模式" divider>
        <div className="flex justify-end w-[60%]">
          <ShortcutInput
            value={globalModeShortcut}
            patchAppConfig={patchAppConfig}
            action="globalModeShortcut"
          />
        </div>
      </SettingItem>
      <SettingItem title="切换直连模式" divider>
        <div className="flex justify-end w-[60%]">
          <ShortcutInput
            value={directModeShortcut}
            patchAppConfig={patchAppConfig}
            action="directModeShortcut"
          />
        </div>
      </SettingItem>
      <SettingItem title="轻量模式" divider>
        <div className="flex justify-end w-[60%]">
          <ShortcutInput
            value={quitWithoutCoreShortcut}
            patchAppConfig={patchAppConfig}
            action="quitWithoutCoreShortcut"
          />
        </div>
      </SettingItem>
      <SettingItem title="重启应用">
        <div className="flex justify-end w-[60%]">
          <ShortcutInput
            value={restartAppShortcut}
            patchAppConfig={patchAppConfig}
            action="restartAppShortcut"
          />
        </div>
      </SettingItem>
    </SettingCard>
  )
}

const ShortcutInput: React.FC<{
  value: string
  action: string
  patchAppConfig: (value: Partial<IAppConfig>) => Promise<void>
}> = (props) => {
  const { value, action, patchAppConfig } = props
  const [inputValue, setInputValue] = useState(value)

  const parseShortcut = (
    event: KeyboardEvent,
    setKey: { (value: React.SetStateAction<string>): void; (arg0: string): void }
  ): void => {
    event.preventDefault()
    let code = event.code
    const key = event.key
    if (code === 'Backspace') {
      setKey('')
    } else {
      let newValue = ''
      if (event.ctrlKey) {
        newValue = 'Ctrl'
      }
      if (event.shiftKey) {
        newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Shift`
      }
      if (event.metaKey) {
        newValue = `${newValue}${newValue.length > 0 ? '+' : ''}${platform === 'darwin' ? 'Command' : 'Super'}`
      }
      if (event.altKey) {
        newValue = `${newValue}${newValue.length > 0 ? '+' : ''}Alt`
      }
      if (code.startsWith('Key')) {
        code = code.substring(3)
      } else if (code.startsWith('Digit')) {
        code = code.substring(5)
      } else if (code.startsWith('Arrow')) {
        code = code.substring(5)
      } else if (key.startsWith('Arrow')) {
        code = key.substring(5)
      } else if (code.startsWith('Intl')) {
        code = code.substring(4)
      } else if (code.startsWith('Numpad')) {
        if (key.length === 1) {
          code = 'Num' + code.substring(6)
        } else {
          code = key
        }
      } else if (/F\d+/.test(code)) {
        // f1-f12
      } else if (keyMap[code] !== undefined) {
        code = keyMap[code]
      } else {
        code = ''
      }
      setKey(`${newValue}${newValue.length > 0 && code.length > 0 ? '+' : ''}${code}`)
    }
  }
  return (
    <>
      {inputValue !== value && (
        <Button
          color="primary"
          className="mr-2"
          size="sm"
          onPress={async () => {
            try {
              if (await registerShortcut(value, inputValue, action)) {
                await patchAppConfig({ [action]: inputValue })
                window.electron.ipcRenderer.send('updateTrayMenu')
              } else {
                alert('快捷键注册失败')
              }
            } catch (e) {
              alert(`快捷键注册失败: ${e}`)
            }
          }}
        >
          确认
        </Button>
      )}
      <Input
        placeholder="点击输入快捷键"
        onKeyDown={(e: KeyboardEvent): void => {
          parseShortcut(e, setInputValue)
        }}
        size="sm"
        onClear={() => setInputValue('')}
        value={inputValue}
        className="w-[calc(100%-72px)] pr-0"
      />
    </>
  )
}

export default ShortcutConfig
