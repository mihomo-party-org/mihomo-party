import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import { BaseEditor } from '@renderer/components/base/base-editor'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  script: string
  onCancel: () => void
  onConfirm: (script: string) => void
}

const PacEditorModal: React.FC<Props> = (props) => {
  const { script, onCancel, onConfirm } = props
  const [currData, setCurrData] = useState(script)
  const { t } = useTranslation()

  return (
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onCancel}
      scrollBehavior="inside"
    >
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex pb-0 app-drag">{t('sysproxy.pacEditor.title')}</ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor
            language="javascript"
            value={currData}
            onChange={(value) => setCurrData(value || '')}
          />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" color="primary" onPress={() => onConfirm(currData)}>
            {t('common.confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default PacEditorModal
