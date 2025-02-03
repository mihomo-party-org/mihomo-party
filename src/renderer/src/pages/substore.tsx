import { Button } from '@heroui/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { subStoreFrontendPort, subStorePort } from '@renderer/utils/ipc'
import React, { useEffect, useState } from 'react'
import { HiExternalLink } from 'react-icons/hi'
import { useTranslation } from 'react-i18next'

const SubStore: React.FC = () => {
  const { t } = useTranslation()
  const { appConfig } = useAppConfig()
  const { useCustomSubStore, customSubStoreUrl } = appConfig || {}
  const [backendPort, setBackendPort] = useState<number | undefined>()
  const [frontendPort, setFrontendPort] = useState<number | undefined>()
  const getPort = async (): Promise<void> => {
    setBackendPort(await subStorePort())
    setFrontendPort(await subStoreFrontendPort())
  }
  useEffect(() => {
    getPort()
  }, [useCustomSubStore])

  if (!useCustomSubStore && !backendPort) return null
  if (!frontendPort) return null
  return (
    <>
      <BasePage
        title={t('substore.title')}
        header={
          <Button
            title={t('substore.openInBrowser')}
            isIconOnly
            size="sm"
            className="app-nodrag"
            variant="light"
            onPress={() => {
              open(
                `http://127.0.0.1:${frontendPort}?api=${useCustomSubStore ? customSubStoreUrl : `http://127.0.0.1:${backendPort}`}`
              )
            }}
          >
            <HiExternalLink className="text-lg" />
          </Button>
        }
      >
        <iframe
          className="w-full h-full"
          allow="clipboard-write; clipboard-read"
          src={`http://127.0.0.1:${frontendPort}?api=${useCustomSubStore ? customSubStoreUrl : `http://127.0.0.1:${backendPort}`}`}
        />
      </BasePage>
    </>
  )
}

export default SubStore
