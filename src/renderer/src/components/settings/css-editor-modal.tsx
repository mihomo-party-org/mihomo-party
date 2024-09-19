import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react'
import { BaseEditor } from '@renderer/components/base/base-editor'
import React, { useState } from 'react'
interface Props {
  css: string
  onCancel: () => void
  onConfirm: (script: string) => void
}
const CSSEditorModal: React.FC<Props> = (props) => {
  const { css, onCancel, onConfirm } = props
  const [currData, setCurrData] = useState(css)

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
        <ModalHeader className="flex pb-0">编辑 CSS</ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor
            language="css"
            value={currData}
            onChange={(value) => setCurrData(value || '')}
          />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onCancel}>
            取消
          </Button>
          <Button size="sm" color="primary" onPress={() => onConfirm(currData)}>
            确认
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default CSSEditorModal
