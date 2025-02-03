import React, { useState } from 'react'
import SettingCard from '../base/base-setting-card'
import SettingItem from '../base/base-setting-item'
import { Button, Input, Select, SelectItem, Switch, Tooltip } from '@heroui/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import debounce from '@renderer/utils/debounce'
import { getGistUrl, patchControledMihomoConfig, restartCore } from '@renderer/utils/ipc'
import { MdDeleteForever } from 'react-icons/md'
import { BiCopy } from 'react-icons/bi'
import { IoIosHelpCircle } from 'react-icons/io'
import { platform } from '@renderer/utils/init'
import { useTranslation } from 'react-i18next'

const MihomoConfig: React.FC = () => {
  const { t } = useTranslation()
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
      <SettingItem title={t('mihomo.userAgent')} divider>
        <Input
          size="sm"
          className="w-[60%]"
          value={ua}
          placeholder={t('mihomo.userAgentPlaceholder')}
          onValueChange={(v) => {
            setUa(v)
            setUaDebounce(v)
          }}
        ></Input>
      </SettingItem>
      <SettingItem title={t('mihomo.delayTest.url')} divider>
        <Input
          size="sm"
          className="w-[60%]"
          value={url}
          placeholder={t('mihomo.delayTest.urlPlaceholder')}
          onValueChange={(v) => {
            setUrl(v)
            setUrlDebounce(v)
          }}
        ></Input>
      </SettingItem>
      <SettingItem title={t('mihomo.delayTest.concurrency')} divider>
        <Input
          type="number"
          size="sm"
          className="w-[60%]"
          value={delayTestConcurrency?.toString()}
          placeholder={t('mihomo.delayTest.concurrencyPlaceholder')}
          onValueChange={(v) => {
            patchAppConfig({ delayTestConcurrency: parseInt(v) })
          }}
        />
      </SettingItem>
      <SettingItem title={t('mihomo.delayTest.timeout')} divider>
        <Input
          type="number"
          size="sm"
          className="w-[60%]"
          value={delayTestTimeout?.toString()}
          placeholder={t('mihomo.delayTest.timeoutPlaceholder')}
          onValueChange={(v) => {
            patchAppConfig({ delayTestTimeout: parseInt(v) })
          }}
        />
      </SettingItem>
      <SettingItem
        title={t('mihomo.gist.title')}
        actions={
          <Button
            title={t('mihomo.gist.copyUrl')}
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
          placeholder={t('mihomo.gist.token')}
          onValueChange={(v) => {
            patchAppConfig({ githubToken: v })
          }}
        />
      </SettingItem>
      <SettingItem title={t('mihomo.proxyColumns.title')} divider>
        <Select
          classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
          className="w-[150px]"
          size="sm"
          selectedKeys={new Set([proxyCols])}
          aria-label={t('mihomo.proxyColumns.title')}
          onSelectionChange={async (v) => {
            await patchAppConfig({ proxyCols: v.currentKey as 'auto' | '1' | '2' | '3' | '4' })
          }}
        >
          <SelectItem key="auto">{t('mihomo.proxyColumns.auto')}</SelectItem>
          <SelectItem key="1">{t('mihomo.proxyColumns.one')}</SelectItem>
          <SelectItem key="2">{t('mihomo.proxyColumns.two')}</SelectItem>
          <SelectItem key="3">{t('mihomo.proxyColumns.three')}</SelectItem>
          <SelectItem key="4">{t('mihomo.proxyColumns.four')}</SelectItem>
        </Select>
      </SettingItem>
      {platform === 'win32' && (
        <SettingItem title={t('mihomo.cpuPriority.title')} divider>
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
            <SelectItem key="PRIORITY_HIGHEST">{t('mihomo.cpuPriority.realtime')}</SelectItem>
            <SelectItem key="PRIORITY_HIGH">{t('mihomo.cpuPriority.high')}</SelectItem>
            <SelectItem key="PRIORITY_ABOVE_NORMAL">{t('mihomo.cpuPriority.aboveNormal')}</SelectItem>
            <SelectItem key="PRIORITY_NORMAL">{t('mihomo.cpuPriority.normal')}</SelectItem>
            <SelectItem key="PRIORITY_BELOW_NORMAL">{t('mihomo.cpuPriority.belowNormal')}</SelectItem>
            <SelectItem key="PRIORITY_LOW">{t('mihomo.cpuPriority.low')}</SelectItem>
          </Select>
        </SettingItem>
      )}
      <SettingItem
        title={t('mihomo.workDir.title')}
        actions={
          <Tooltip content={t('mihomo.workDir.tooltip')}>
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
      <SettingItem title={t('mihomo.controlDns')} divider>
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
      <SettingItem title={t('mihomo.controlSniff')} divider>
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
      <SettingItem title={t('mihomo.autoCloseConnection')} divider>
        <Switch
          size="sm"
          isSelected={autoCloseConnection}
          onValueChange={(v) => {
            patchAppConfig({ autoCloseConnection: v })
          }}
        />
      </SettingItem>
      <SettingItem title={t('mihomo.pauseSSID.title')}>
        {pauseSSIDInput.join('') !== pauseSSID.join('') && (
          <Button
            size="sm"
            color="primary"
            onPress={() => {
              patchAppConfig({ pauseSSID: pauseSSIDInput })
            }}
          >
            {t('common.confirm')}
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
                  onPress={() => setPauseSSIDInput(pauseSSIDInput.filter((_, i) => i !== index))}
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
