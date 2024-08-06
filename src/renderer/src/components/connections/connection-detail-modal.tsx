import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react'
import React from 'react'
interface Props {
  connection: IMihomoConnectionDetail
  onClose: () => void
}
const ConnectionDetailModal: React.FC<Props> = (props) => {
  const { connection, onClose } = props

  return (
    <Modal size="xl" hideCloseButton isOpen={true} scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex">连接详情</ModalHeader>
        <ModalBody>
          <pre>
            <code>{JSON.stringify(connection, null, 2)}</code>
          </pre>
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConnectionDetailModal
