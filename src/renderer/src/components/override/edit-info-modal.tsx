import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Switch
} from '@nextui-org/react'
import React, { useState } from 'react'
import SettingItem from '../base/base-setting-item'
import { restartCore } from '@renderer/utils/ipc'
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
    await restartCore()
    onClose()
  }

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
        <ModalHeader className="flex app-drag">编辑信息</ModalHeader>
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
          <SettingItem title="全局启用">
            <Switch
              size="sm"
              isSelected={values.global}
              onValueChange={(v) => {
                setValues({ ...values, global: v })
              }}
            />
          </SettingItem>
        </ModalBody>
        <ModalFooter>
          <Button size="sm" variant="light" onPress={onClose}>
            取消
          </Button>
          <Button size="sm" color="primary" onPress={onSave}>
            保存
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditInfoModal
