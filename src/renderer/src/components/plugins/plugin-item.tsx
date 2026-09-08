import { Card, CardBody, Chip, Button, Select, SelectItem, Tooltip } from '@heroui/react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@renderer/components/base/toast'
import { removePlugin, loginPlugin, patchPluginItem } from '@renderer/utils/ipc'
import BaseConfirmModal from '@renderer/components/base/base-confirm-modal'
import { TbPuzzle } from 'react-icons/tb'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  item: IPluginItem
  onChanged: () => void
}

const statusColor: Record<IPluginStatus, 'success' | 'warning' | 'primary'> = {
  active: 'success',
  'needs-login': 'primary',
  'needs-reauth': 'warning'
}

const ROUTE_MODES: IPluginRouteMode[] = ['auto', 'direct', 'proxy']

// 与主进程 route.ts 的五行迁移表一致：routeMode 有 → 取其值；无 → useProxy=true → proxy，false → auto；
// 都无 → 全局 pluginUseProxy=true → proxy，否则 auto。
function effectiveRouteMode(item: IPluginItem, globalUseProxy: boolean): IPluginRouteMode {
  if (item.routeMode && ROUTE_MODES.includes(item.routeMode)) return item.routeMode
  if (typeof item.useProxy === 'boolean') return item.useProxy ? 'proxy' : 'auto'
  return globalUseProxy ? 'proxy' : 'auto'
}

const PluginItem: React.FC<Props> = ({ item, onChanged }) => {
  const { t } = useTranslation()
  const { appConfig } = useAppConfig()
  const routeMode = effectiveRouteMode(item, appConfig?.pluginUseProxy ?? false)

  const [busy, setBusy] = useState(false)
  const [showRemove, setShowRemove] = useState(false)

  const doLogin = async (): Promise<void> => {
    setBusy(true)
    toast.info(t('plugins.loginInProgress'))
    try {
      await loginPlugin(item.id)
      toast.success(t('plugins.loginSuccess'))
    } catch {
      toast.error(t('plugins.loginFailed'))
    } finally {
      setBusy(false)
      onChanged()
    }
  }

  const handleRouteChange = async (mode: IPluginRouteMode): Promise<void> => {
    if (!ROUTE_MODES.includes(mode) || mode === routeMode) return
    try {
      // 镜像写 useProxy，供降级到旧版本读取
      await patchPluginItem(item.id, { routeMode: mode, useProxy: mode === 'proxy' })
      onChanged()
    } catch (e) {
      toast.error(String(e))
    }
  }

  const needsLogin = item.status === 'needs-login'
  const needsReauth = item.status === 'needs-reauth'

  return (
    <Card className="overflow-hidden">
      <CardBody className="flex flex-col gap-2 overflow-x-hidden">
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-primary min-w-0">
            <TbPuzzle className="text-lg flex-shrink-0" />
            <span className="font-bold text-foreground truncate">{item.name}</span>
          </div>
          <Chip size="sm" color={statusColor[item.status]} className="flex-shrink-0">
            {t(`plugins.status.${item.status}`)}
          </Chip>
        </div>
        <span className="text-xs text-foreground-500 truncate" title={item.loginUrl}>
          {item.loginUrl}
        </span>

        {needsLogin && <div className="text-xs text-primary">{t('plugins.needsLoginTip')}</div>}
        {needsReauth && <div className="text-xs text-warning">{t('plugins.reauthTip')}</div>}
        {item.lastUpdateErrorReason && (
          <div className="text-xs text-warning">
            {t(`plugins.errorReason.${item.lastUpdateErrorReason}`)}
          </div>
        )}
        {item.lastProviderMessage && (
          <div className="text-xs text-warning whitespace-pre-line break-words">
            {t('plugins.providerMessage')}: {item.lastProviderMessage}
          </div>
        )}
        {item.description && (
          <div className="text-xs text-foreground-500 whitespace-pre-line break-words">
            {item.description}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 flex-wrap min-w-0">
          <div className="flex items-center gap-2">
            {needsLogin && (
              <Button size="sm" color="primary" isLoading={busy} onPress={doLogin}>
                {t('plugins.login')}
              </Button>
            )}
            {needsReauth && (
              <Button size="sm" color="warning" isLoading={busy} onPress={doLogin}>
                {t('plugins.relogin')}
              </Button>
            )}
            <Button size="sm" variant="flat" color="danger" onPress={() => setShowRemove(true)}>
              {t('plugins.remove')}
            </Button>
          </div>
          <Tooltip content={t('plugins.useProxyWarning')} placement="bottom">
            <div className="flex items-center gap-2">
              <span className="text-xs text-foreground-500">{t('plugins.routeMode')}</span>
              <Select
                classNames={{ trigger: 'data-[hover=true]:bg-default-200' }}
                className="w-28"
                size="sm"
                aria-label={t('plugins.routeMode')}
                selectedKeys={[routeMode]}
                onSelectionChange={(v) => {
                  const key = Array.from(v)[0] as IPluginRouteMode | undefined
                  if (key) handleRouteChange(key)
                }}
              >
                {ROUTE_MODES.map((mode) => (
                  <SelectItem key={mode}>{t(`plugins.route.${mode}`)}</SelectItem>
                ))}
              </Select>
            </div>
          </Tooltip>
        </div>
      </CardBody>

      {showRemove && (
        <BaseConfirmModal
          isOpen={showRemove}
          title={t('plugins.remove')}
          content={t('plugins.removeConfirm')}
          onCancel={() => setShowRemove(false)}
          onConfirm={async () => {
            try {
              await removePlugin(item.id)
            } finally {
              onChanged()
            }
            setShowRemove(false)
          }}
        />
      )}
    </Card>
  )
}

export default PluginItem
