import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor'
import { getOverride, restartCore, setOverride } from '@renderer/utils/ipc'
interface Props {
  id: string
  language: 'javascript' | 'yaml'
  onClose: () => void
}
const EditFileModal: React.FC<Props> = (props) => {
  const { id, language, onClose } = props
  const [currData, setCurrData] = useState('')

  const getContent = async (): Promise<void> => {
    setCurrData(await getOverride(id, language === 'javascript' ? 'js' : 'yaml'))
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
          编辑覆写{language === 'javascript' ? '脚本' : '配置'}
        </ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor
            language={language}
            value={currData}
            onChange={(value) => setCurrData(value)}
          />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onClose}>
            取消
          </Button>
          <Button
            size="sm"
            color="primary"
            onPress={async () => {
              try {
                await setOverride(id, language === 'javascript' ? 'js' : 'yaml', currData)
                await restartCore()
                onClose()
              } catch (e) {
                alert(e)
              }
            }}
          >
            确认
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditFileModal
