import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface Props {
  title: string
  content: string
  onCancel: () => void
  onConfirm: () => void
  isOpen: boolean
  cancelText?: string
  confirmText?: string
  isLoading?: boolean
}

const BaseConfirmModal: React.FC<Props> = (props) => {
  const { t } = useTranslation()
  const { title, content, onCancel, onConfirm, isOpen, cancelText, confirmText, isLoading } = props

  return (
    <Modal backdrop="blur" classNames={{ backdrop: 'top-[48px]' }} hideCloseButton isOpen={isOpen}>
      <ModalContent>
        <ModalHeader className="flex app-drag">{title}</ModalHeader>
        <ModalBody>
          <p>{content}</p>
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" isDisabled={isLoading} onPress={onCancel}>
            {cancelText ?? t('common.cancel')}
          </Button>
          <Button size="sm" color="danger" isLoading={isLoading} onPress={onConfirm}>
            {confirmText ?? t('common.confirm')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default BaseConfirmModal
