import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react'
import { webdavRestore } from '@renderer/utils/ipc'
import React, { useState } from 'react'
interface Props {
  filenames: string[]
  onClose: () => void
}
const WebdavRestoreModal: React.FC<Props> = (props) => {
  const { filenames, onClose } = props
  const [restoring, setRestoring] = useState(false)

  return (
    <Modal
      backdrop="blur"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex">恢复备份</ModalHeader>
        <ModalBody>
          {filenames.length === 0 ? (
            <div className="flex justify-center">还没有备份</div>
          ) : (
            filenames.map((filename) => (
              <Button
                size="sm"
                fullWidth
                key={filename}
                isLoading={restoring}
                variant="flat"
                onPress={async () => {
                  setRestoring(true)
                  try {
                    await webdavRestore(filename)
                  } catch (e) {
                    alert(`恢复失败: ${e}`)
                  } finally {
                    setRestoring(false)
                  }
                }}
              >
                {filename}
              </Button>
            ))
          )}
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

export default WebdavRestoreModal
