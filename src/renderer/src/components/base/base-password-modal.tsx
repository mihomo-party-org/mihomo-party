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
    <Modal hideCloseButton isOpen={true}>
      <ModalContent>
        <ModalHeader className="flex">请输入root密码</ModalHeader>
        <ModalBody>
          <Input fullWidth type="password" value={password} onValueChange={setPassword} />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onCancel}>
            取消
          </Button>
          <Button color="primary" onPress={() => onConfirm(password)}>
            确认
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default BasePasswordModal
