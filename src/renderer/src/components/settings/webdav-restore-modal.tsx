import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react'
import { relaunchApp, webdavDelete, webdavRestore } from '@renderer/utils/ipc'
import React, { useState } from 'react'
import { MdDeleteForever } from 'react-icons/md'
interface Props {
  filenames: string[]
  onClose: () => void
}
const WebdavRestoreModal: React.FC<Props> = (props) => {
  const { filenames: names, onClose } = props
  const [filenames, setFilenames] = useState<string[]>(names)
  const [restoring, setRestoring] = useState(false)

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
        <ModalHeader className="flex app-drag">恢复备份</ModalHeader>
        <ModalBody>
          {filenames.length === 0 ? (
            <div className="flex justify-center">还没有备份</div>
          ) : (
            filenames.map((filename) => (
              <div className="flex" key={filename}>
                <Button
                  size="sm"
                  fullWidth
                  isLoading={restoring}
                  variant="flat"
                  onPress={async () => {
                    setRestoring(true)
                    try {
                      await webdavRestore(filename)
                      await relaunchApp()
                    } catch (e) {
                      alert(`恢复失败: ${e}`)
                    } finally {
                      setRestoring(false)
                    }
                  }}
                >
                  {filename}
                </Button>
                <Button
                  size="sm"
                  color="warning"
                  variant="flat"
                  className="ml-2"
                  onClick={async () => {
                    try {
                      await webdavDelete(filename)
                      setFilenames(filenames.filter((name) => name !== filename))
                    } catch (e) {
                      alert(`删除失败: ${e}`)
                    }
                  }}
                >
                  <MdDeleteForever className="text-lg" />
                </Button>
              </div>
            ))
          )}
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

export default WebdavRestoreModal
