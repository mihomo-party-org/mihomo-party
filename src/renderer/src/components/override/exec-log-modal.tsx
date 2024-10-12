import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Divider
} from '@nextui-org/react'
import React, { useEffect, useState } from 'react'
import { getOverride } from '@renderer/utils/ipc'
interface Props {
  id: string
  onClose: () => void
}
const ExecLogModal: React.FC<Props> = (props) => {
  const { id, onClose } = props
  const [logs, setLogs] = useState<string[]>([])

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
        <ModalHeader className="flex app-drag">执行日志</ModalHeader>
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
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ExecLogModal
