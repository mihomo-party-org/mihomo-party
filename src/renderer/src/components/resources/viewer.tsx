import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor'
import { getFileStr, setFileStr } from '@renderer/utils/ipc'
type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'

interface Props {
  onClose: () => void
  path: string
  type: string
  title: string
  format?: string
}
const Viewer: React.FC<Props> = (props) => {
  const { type, path, title, format, onClose } = props
  const [currData, setCurrData] = useState('')
  const language: Language = !format || format === 'YamlRule' ? 'yaml' : 'text'

  const getContent = async (): Promise<void> => {
    setCurrData(await getFileStr(path))
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
        <ModalHeader className="flex pb-0 app-drag">{title}</ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor
            language={language}
            value={currData}
            readOnly={type != 'File'}
            onChange={(value) => setCurrData(value)}
          />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onClose}>
            关闭
          </Button>
          {type == 'File' && (
            <Button
              size="sm"
              color="primary"
              onPress={async () => {
                await setFileStr(path, currData)
                onClose()
              }}
            >
              保存
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default Viewer
