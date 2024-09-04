import { Button } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { subStorePort } from '@renderer/utils/ipc'
import React, { useEffect, useState } from 'react'
import { HiExternalLink } from 'react-icons/hi'

const SubStore: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { useCustomSubStore, customSubStoreUrl } = appConfig || {}
  const [port, setPort] = useState<number | undefined>()

  const getPort = async (): Promise<void> => {
    setPort(await subStorePort())
  }
  useEffect(() => {
    if (!useCustomSubStore) {
      getPort()
    }
  }, [useCustomSubStore])
  if (!useCustomSubStore && !port) return null
  return (
    <>
      <BasePage
        title="Sub-Store"
        header={
          <Button
            title="在浏览器中打开"
            isIconOnly
            size="sm"
            className="app-nodrag"
            variant="light"
            onPress={() => {
              open(
                `https://sub-store.vercel.app/subs?api=${useCustomSubStore ? customSubStoreUrl : `http://127.0.0.1:${port}`}`
              )
            }}
          >
            <HiExternalLink className="text-lg" />
          </Button>
        }
      >
        <iframe
          className="w-full h-full"
          src={`https://sub-store.vercel.app/subs?api=${useCustomSubStore ? customSubStoreUrl : `http://127.0.0.1:${port}`}`}
        />
      </BasePage>
    </>
  )
}

export default SubStore
