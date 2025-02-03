import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Divider
} from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { getOverride } from '@renderer/utils/ipc'
import { useTranslation } from 'react-i18next'

interface Props {
  id: string
  onClose: () => void
}
const ExecLogModal: React.FC<Props> = (props) => {
  const { id, onClose } = props
  const [logs, setLogs] = useState<string[]>([])
  const { t } = useTranslation()

  const getLog = async (): Promise<void> => {
    setLogs((await getOverride(id, 'log')).split('\n').filter(Boolean))
  }

  useEffect(() => {
    getLog()
  }, [])

  return (
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex app-drag">{t('override.execLog.title')}</ModalHeader>
        <ModalBody>
          {logs.map((log) => {
            return (
              <>
                <small className="break-all select-text">{log}</small>
                <Divider />
              </>
            )
          })}
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" onPress={onClose}>
            {t('override.execLog.close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ExecLogModal
