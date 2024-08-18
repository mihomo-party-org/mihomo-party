import { Button } from '@nextui-org/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { checkUpdate } from '@renderer/utils/ipc'
import React, { useState } from 'react'
import useSWR from 'swr'
import UpdaterModal from './updater-modal'

const UpdaterButton: React.FC = () => {
  const { appConfig } = useAppConfig()
  const { autoCheckUpdate } = appConfig || {}
  const [openModal, setOpenModal] = useState(false)
  const { data: latest } = useSWR(
    autoCheckUpdate ? 'checkUpdate' : undefined,
    autoCheckUpdate ? checkUpdate : (): undefined => {},
    {
      refreshInterval: 1000 * 60 * 10
    }
  )
  if (!latest) return null

  return (
    <>
      {openModal && (
        <UpdaterModal
          version={latest.version}
          changelog={latest.changelog}
          onClose={() => {
            setOpenModal(false)
          }}
        />
      )}
      <Button
        color="danger"
        size="sm"
        onPress={() => {
          setOpenModal(true)
        }}
      >
        v{latest.version}
      </Button>
    </>
  )
}

export default UpdaterButton
