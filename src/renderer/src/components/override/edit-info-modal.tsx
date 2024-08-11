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
import SettingItem from '../base/base-setting-item'
interface Props {
  item: IOverrideItem
  updateOverrideItem: (item: IOverrideItem) => Promise<void>
  onClose: () => void
}
const EditInfoModal: React.FC<Props> = (props) => {
  const { item, updateOverrideItem, onClose } = props
  const [values, setValues] = useState(item)

  const onSave = async (): Promise<void> => {
    await updateOverrideItem(values)
    onClose()
  }

  return (
    <Modal
      backdrop="blur"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent>
        <ModalHeader className="flex">编辑信息</ModalHeader>
        <ModalBody>
          <SettingItem title="名称">
            <Input
              size="sm"
              className="w-[200px]"
              value={values.name}
              onValueChange={(v) => {
                setValues({ ...values, name: v })
              }}
            />
          </SettingItem>
          {values.type === 'remote' && (
            <SettingItem title="地址">
              <Input
                size="sm"
                className="w-[200px]"
                value={values.url}
                onValueChange={(v) => {
                  setValues({ ...values, url: v })
                }}
              />
            </SettingItem>
          )}
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            取消
          </Button>
          <Button color="primary" onPress={onSave}>
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditInfoModal
