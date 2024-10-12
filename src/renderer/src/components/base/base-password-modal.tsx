import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input
} from '@nextui-org/react'
import React, { useState } from 'react'

interface Props {
  onCancel: () => void
  onConfirm: (script: string) => void
}

const BasePasswordModal: React.FC<Props> = (props) => {
  const { onCancel, onConfirm } = props
  const [password, setPassword] = useState('')

  return (
    <Modal backdrop="blur" classNames={{ backdrop: 'top-[48px]' }} hideCloseButton isOpen={true}>
      <ModalContent>
        <ModalHeader className="flex app-drag">请输入root密码</ModalHeader>
        <ModalBody>
          <Input fullWidth type="password" value={password} onValueChange={setPassword} />
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" onPress={onCancel}>
            取消
          </Button>
          <Button size="sm" color="primary" onPress={() => onConfirm(password)}>
            确认
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default BasePasswordModal
