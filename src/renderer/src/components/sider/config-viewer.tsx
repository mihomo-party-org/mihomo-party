import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor'
import { getRuntimeConfigStr } from '@renderer/utils/ipc'
import { useTranslation } from 'react-i18next'

interface Props {
  onClose: () => void
}
const ConfigViewer: React.FC<Props> = (props) => {
  const { t } = useTranslation()
  const { onClose } = props
  const [currData, setCurrData] = useState('')

  const getContent = async (): Promise<void> => {
    setCurrData(await getRuntimeConfigStr())
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
        <ModalHeader className="flex pb-0 app-drag">{t('sider.cards.config')}</ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor language="yaml" value={currData} readOnly={true} />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onClose}>
            {t('common.close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConfigViewer
