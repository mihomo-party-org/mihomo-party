import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from '@renderer/components/base/toast'
import { takeDnsOverrideAutoDisabledNotice } from '@renderer/utils/ipc'
import { useAppConfig } from './use-app-config'

const NOTICE_DURATION_MS = 6000

// 挂载、窗口显示和实时事件统一补取通知，由主进程检查可见性并去重。
export function useDnsOverrideAutoDisabledNotice(): void {
  const { t } = useTranslation()
  const { mutateAppConfig } = useAppConfig()

  useEffect(() => {
    const claim = async (): Promise<void> => {
      let pending = false
      try {
        pending = await takeDnsOverrideAutoDisabledNotice()
      } catch {
        return
      }
      if (!pending) return
      mutateAppConfig()
      toast.warning(t('dns.overrideGuard.autoDisabled'), undefined, NOTICE_DURATION_MS)
    }
    const onShown = (): void => {
      void claim()
    }
    const unsubscribe = window.electron.ipcRenderer.on('dnsOverrideAutoDisabled', onShown)
    window.addEventListener('focus', onShown)
    document.addEventListener('visibilitychange', onShown)
    void claim()
    return () => {
      unsubscribe()
      window.removeEventListener('focus', onShown)
      document.removeEventListener('visibilitychange', onShown)
    }
  }, [t, mutateAppConfig])
}
