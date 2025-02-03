import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor'
import { getProfileStr, setProfileStr } from '@renderer/utils/ipc'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

interface Props {
  id: string
  onClose: () => void
}

const EditFileModal: React.FC<Props> = (props) => {
  const { id, onClose } = props
  const [currData, setCurrData] = useState('')
  const navigate = useNavigate()
  const { t } = useTranslation()

  const getContent = async (): Promise<void> => {
    setCurrData(await getProfileStr(id))
  }

  useEffect(() => {
    getContent()
  }, [])

  return (
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex pb-0 app-drag">
          <div className="flex justify-start">
            <div className="flex items-center">{t('profiles.editFile.title')}</div>
            <small className="ml-2 text-foreground-500">
              {t('profiles.editFile.notice')}
              <Button
                size="sm"
                color="primary"
                variant="light"
                className="app-nodrag"
                onPress={() => {
                  navigate('/override')
                }}
              >
                {t('profiles.editFile.override')}
              </Button>
              {t('profiles.editFile.feature')}
            </small>
          </div>
        </ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor language="yaml" value={currData} onChange={(value) => setCurrData(value)} />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button
            size="sm"
            color="primary"
            onPress={async () => {
              await setProfileStr(id, currData)
              onClose()
            }}
          >
            {t('common.confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditFileModal
