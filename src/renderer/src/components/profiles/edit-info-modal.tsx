import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  Select,
  SelectItem,
  Switch
} from '@nextui-org/react'
import React, { useState } from 'react'
import SettingItem from '../base/base-setting-item'
import { useOverrideConfig } from '@renderer/hooks/use-override-config'
import { restartCore } from '@renderer/utils/ipc'
interface Props {
  item: IProfileItem
  updateProfileItem: (item: IProfileItem) => Promise<void>
  onClose: () => void
}
const EditInfoModal: React.FC<Props> = (props) => {
  const { item, updateProfileItem, onClose } = props
  const { overrideConfig } = useOverrideConfig()
  const { items: overrideItems = [] } = overrideConfig || {}
  const [values, setValues] = useState(item)

  const onSave = async (): Promise<void> => {
    try {
      await updateProfileItem(values)
      await restartCore()
      onClose()
    } catch (e) {
      alert(e)
    }
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
            <>
              <SettingItem title="订阅地址">
                <Input
                  size="sm"
                  className="w-[200px]"
                  value={values.url}
                  onValueChange={(v) => {
                    setValues({ ...values, url: v })
                  }}
                />
              </SettingItem>
              <SettingItem title="使用代理更新">
                <Switch
                  size="sm"
                  isSelected={values.useProxy ?? false}
                  onValueChange={(v) => {
                    setValues({ ...values, useProxy: v })
                  }}
                />
              </SettingItem>
              <SettingItem title="更新间隔（分钟）">
                <Input
                  size="sm"
                  type="number"
                  className="w-[200px]"
                  value={values.interval?.toString() ?? ''}
                  onValueChange={(v) => {
                    setValues({ ...values, interval: parseInt(v) })
                  }}
                />
              </SettingItem>
            </>
          )}
          <SettingItem title="覆写">
            <Select
              className="w-[200px]"
              size="sm"
              selectionMode="multiple"
              selectedKeys={new Set(values.override || [])}
              onSelectionChange={(v) => {
                setValues({
                  ...values,
                  override: Array.from(v)
                    .map((i) => i.toString())
                    .filter((i) => overrideItems.find((t) => t.id === i))
                })
              }}
            >
              {overrideItems.map((i) => (
                <SelectItem key={i.id}>{i.name}</SelectItem>
              ))}
            </Select>
          </SettingItem>
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
