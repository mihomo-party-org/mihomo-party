import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor'
import { getRuntimeConfigStr } from '@renderer/utils/ipc'
interface Props {
  onClose: () => void
}
const ConfigViewer: React.FC<Props> = (props) => {
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
        <ModalHeader className="flex pb-0 app-drag">当前运行时配置</ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor language="yaml" value={currData} readOnly={true} />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onClose}>
            关闭
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default ConfigViewer
