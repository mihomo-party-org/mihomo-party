import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Input, Select, SelectItem, Switch, Tooltip } from '@nextui-org/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import debounce from '@renderer/utils/debounce'
import { getGistUrl, patchControledMihomoConfig, restartCore } from '@renderer/utils/ipc'
import { MdDeleteForever } from 'react-icons/md'
import { BiCopy } from 'react-icons/bi'
import { IoIosHelpCircle } from 'react-icons/io'
import { platform } from '@renderer/utils/init'

const MihomoConfig: React.FC = () => {
  const { appConfig, patchAppConfig } = useAppConfig()
  const {
    diffWorkDir = false,
    controlDns = true,
    controlSniff = true,
    delayTestConcurrency,
    delayTestTimeout,
    githubToken = '',
    autoCloseConnection = true,
    pauseSSID = [],
    delayTestUrl,
    userAgent,
    mihomoCpuPriority = 'PRIORITY_NORMAL',
    proxyCols = 'auto'
  } = appConfig || {}
  const [url, setUrl] = useState(delayTestUrl)
  const [pauseSSIDInput, setPauseSSIDInput] = useState(pauseSSID)
  const setUrlDebounce = debounce((v: string) => {
    patchAppConfig({ delayTestUrl: v })
  }, 500)
  const [ua, setUa] = useState(userAgent)
  const setUaDebounce = debounce((v: string) => {
    patchAppConfig({ userAgent: v })
  }, 500)
  return (
    <SettingCard>
      <SettingItem title="订阅拉取 UA" divider>
        <Input
          size="sm"
          className="w-[60%]"
          value={ua}
          placeholder="默认 clash.meta"
          onValueChange={(v) => {
            setUa(v)
            setUaDebounce(v)
          }}
        ></Input>
      </SettingItem>
      <SettingItem title="延迟测试地址" divider>
        <Input
          size="sm"
          className="w-[60%]"
          value={url}
          placeholder="默认 https://www.gstatic.com/generate_204"
          onValueChange={(v) => {
            setUrl(v)
            setUrlDebounce(v)
          }}
        ></Input>
      </SettingItem>
      <SettingItem title="延迟测试并发数量" divider>
        <Input
          type="number"
          size="sm"
          className="w-[60%]"
          value={delayTestConcurrency?.toString()}
          placeholder="默认 50"
          onValueChange={(v) => {
            patchAppConfig({ delayTestConcurrency: parseInt(v) })
          }}
        />
      </SettingItem>
      <SettingItem title="延迟测试超时时间" divider>
        <Input
          type="number"
          size="sm"
          className="w-[60%]"
          value={delayTestTimeout?.toString()}
          placeholder="默认 5000"
          onValueChange={(v) => {
            patchAppConfig({ delayTestTimeout: parseInt(v) })
          }}
        />
      </SettingItem>
      <SettingItem
        title="同步运行时配置到 Gist"
        actions={
          <Button
            title="复制 Gist URL"
            isIconOnly
            size="sm"
            variant="light"
            onPress={async () => {
              try {
                const url = await getGistUrl()
                if (url !== '') {
                  await navigator.clipboard.writeText(`${url}/raw/mihomo-party.yaml`)
                }
              } catch (e) {
                alert(e)
              }
            }}
          >
            <BiCopy className="text-lg" />
          </Button>
        }
        divider
      >
        <Input
          type="password"
          size="sm"
          className="w-[60%]"
          value={githubToken}
          placeholder="GitHub Token"
          onValueChange={(v) => {
            patchAppConfig({ githubToken: v })
          }}
        />
      </SettingItem>
      <SettingItem title="代理节点展示列数" divider>
        <Select
          classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
          className="w-[150px]"
          size="sm"
          selectedKeys={new Set([proxyCols])}
          onSelectionChange={async (v) => {
            await patchAppConfig({ proxyCols: v.currentKey as 'auto' | '1' | '2' | '3' | '4' })
          }}
        >
          <SelectItem key="auto">自动</SelectItem>
          <SelectItem key="1">一列</SelectItem>
          <SelectItem key="2">两列</SelectItem>
          <SelectItem key="3">三列</SelectItem>
          <SelectItem key="4">四列</SelectItem>
        </Select>
      </SettingItem>
      {platform === 'win32' && (
        <SettingItem title="内核进程优先级" divider>
          <Select
            classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
            className="w-[150px]"
            size="sm"
            selectedKeys={new Set([mihomoCpuPriority])}
            onSelectionChange={async (v) => {
              try {
                await patchAppConfig({
                  mihomoCpuPriority: v.currentKey as Priority
                })
                await restartCore()
              } catch (e) {
                alert(e)
              }
            }}
          >
            <SelectItem key="PRIORITY_HIGHEST">实时</SelectItem>
            <SelectItem key="PRIORITY_HIGH">高</SelectItem>
            <SelectItem key="PRIORITY_ABOVE_NORMAL">高于正常</SelectItem>
            <SelectItem key="PRIORITY_NORMAL">正常</SelectItem>
            <SelectItem key="PRIORITY_BELOW_NORMAL">低于正常</SelectItem>
            <SelectItem key="PRIORITY_LOW">低</SelectItem>
          </Select>
        </SettingItem>
      )}
      <SettingItem
        title="为不同订阅分别指定工作目录"
        actions={
          <Tooltip content="开启后可以避免不同订阅中存在相同代理组名时无法分别保存选择的节点">
            <Button isIconOnly size="sm" variant="light">
              <IoIosHelpCircle className="text-lg" />
            </Button>
          </Tooltip>
        }
        divider
      >
        <Switch
          size="sm"
          isSelected={diffWorkDir}
          onValueChange={async (v) => {
            try {
              await patchAppConfig({ diffWorkDir: v })
              await restartCore()
            } catch (e) {
              alert(e)
            }
          }}
        />
      </SettingItem>
      <SettingItem title="接管 DNS 设置" divider>
        <Switch
          size="sm"
          isSelected={controlDns}
          onValueChange={async (v) => {
            try {
              await patchAppConfig({ controlDns: v })
              await patchControledMihomoConfig({})
              await restartCore()
            } catch (e) {
              alert(e)
            }
          }}
        />
      </SettingItem>
      <SettingItem title="接管域名嗅探设置" divider>
        <Switch
          size="sm"
          isSelected={controlSniff}
          onValueChange={async (v) => {
            try {
              await patchAppConfig({ controlSniff: v })
              await patchControledMihomoConfig({})
              await restartCore()
            } catch (e) {
              alert(e)
            }
          }}
        />
      </SettingItem>
      <SettingItem title="自动断开连接" divider>
        <Switch
          size="sm"
          isSelected={autoCloseConnection}
          onValueChange={(v) => {
            patchAppConfig({ autoCloseConnection: v })
          }}
        />
      </SettingItem>
      <SettingItem title="在特定的 WiFi SSID 下直连">
        {pauseSSIDInput.join('') !== pauseSSID.join('') && (
          <Button
            size="sm"
            color="primary"
            onPress={() => {
              patchAppConfig({ pauseSSID: pauseSSIDInput })
            }}
          >
            确认
          </Button>
        )}
      </SettingItem>
      <div className="flex flex-col items-stretch mt-2">
        {[...pauseSSIDInput, ''].map((ssid, index) => {
          return (
            <div key={index} className="flex mb-2">
              <Input
                size="sm"
                fullWidth
                placeholder="SSID"
                value={ssid || ''}
                onValueChange={(v) => {
                  if (index === pauseSSIDInput.length) {
                    setPauseSSIDInput([...pauseSSIDInput, v])
                  } else {
                    setPauseSSIDInput(pauseSSIDInput.map((a, i) => (i === index ? v : a)))
                  }
                }}
              />
              {index < pauseSSIDInput.length && (
                <Button
                  className="ml-2"
                  size="sm"
                  variant="flat"
                  color="warning"
                  onClick={() => setPauseSSIDInput(pauseSSIDInput.filter((_, i) => i !== index))}
                >
                  <MdDeleteForever className="text-lg" />
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </SettingCard>
  )
}

export default MihomoConfig
