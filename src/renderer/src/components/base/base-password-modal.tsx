import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input
} from '@heroui/react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  onCancel: () => void
  onConfirm: (script: string) => void
}

const BasePasswordModal: React.FC<Props> = (props) => {
  const { t } = useTranslation()
  const { onCancel, onConfirm } = props
  const [password, setPassword] = useState('')

  return (
    <Modal backdrop="blur" classNames={{ backdrop: 'top-[48px]' }} hideCloseButton isOpen={true}>
      <ModalContent>
        <ModalHeader className="flex app-drag">{t('common.enterRootPassword')}</ModalHeader>
        <ModalBody>
          <Input fullWidth type="password" value={password} onValueChange={setPassword} />
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" onPress={onCancel}>
            {t('common.cancel')}
          </Button>
          <Button size="sm" color="primary" onPress={() => onConfirm(password)}>
            {t('common.confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default BasePasswordModal
