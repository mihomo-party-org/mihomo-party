import {
  Button,
  Card,
  CardBody,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger
} from '@nextui-org/react'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import React, { Key, useEffect, useState } from 'react'
import EditFileModal from './edit-file-modal'
import EditInfoModal from './edit-info-modal'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ExecLogModal from './exec-log-modal'
import { openFile } from '@renderer/utils/ipc'

interface Props {
  info: IOverrideItem
  addOverrideItem: (item: Partial<IOverrideItem>) => Promise<void>
  updateOverrideItem: (item: IOverrideItem) => Promise<void>
  removeOverrideItem: (id: string) => Promise<void>
  mutateOverrideConfig: () => void
}

interface MenuItem {
  key: string
  label: string
  showDivider: boolean
  color: 'default' | 'danger'
  className: string
}

const menuItems: MenuItem[] = [
  {
    key: 'edit-info',
    label: '编辑信息',
    showDivider: false,
    color: 'default',
    className: ''
  } as MenuItem,
  {
    key: 'edit-file',
    label: '编辑文件',
    showDivider: false,
    color: 'default',
    className: ''
  } as MenuItem,
  {
    key: 'open-file',
    label: '打开文件',
    showDivider: false,
    color: 'default',
    className: ''
  } as MenuItem,
  {
    key: 'exec-log',
    label: '执行日志',
    showDivider: true,
    color: 'default',
    className: ''
  } as MenuItem,
  {
    key: 'delete',
    label: '删除',
    showDivider: false,
    color: 'danger',
    className: 'text-danger'
  } as MenuItem
]

const OverrideItem: React.FC<Props> = (props) => {
  const { info, addOverrideItem, removeOverrideItem, mutateOverrideConfig, updateOverrideItem } =
    props
  const [updating, setUpdating] = useState(false)
  const [openInfoEditor, setOpenInfoEditor] = useState(false)
  const [openFileEditor, setOpenFileEditor] = useState(false)
  const [openLog, setOpenLog] = useState(false)
  const {
    attributes,
    listeners,
    setNodeRef,
    transform: tf,
    transition,
    isDragging
  } = useSortable({
    id: info.id
  })
  const transform = tf ? { x: tf.x, y: tf.y, scaleX: 1, scaleY: 1 } : null
  const [disableOpen, setDisableOpen] = useState(false)

  const onMenuAction = (key: Key): void => {
    switch (key) {
      case 'edit-info': {
        setOpenInfoEditor(true)
        break
      }
      case 'edit-file': {
        setOpenFileEditor(true)
        break
      }
      case 'open-file': {
        openFile('override', info.id, info.ext)
        break
      }
      case 'exec-log': {
        setOpenLog(true)
        break
      }
      case 'delete': {
        removeOverrideItem(info.id)
        mutateOverrideConfig()
        break
      }
    }
  }

  useEffect(() => {
    if (isDragging) {
      setTimeout(() => {
        setDisableOpen(true)
      }, 200)
    } else {
      setTimeout(() => {
        setDisableOpen(false)
      }, 200)
    }
  }, [isDragging])

  return (
    <div
      className="grid col-span-1"
      style={{
        position: 'relative',
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 'calc(infinity)' : undefined
      }}
    >
      {openFileEditor && (
        <EditFileModal
          id={info.id}
          language={info.ext === 'yaml' ? 'yaml' : 'javascript'}
          onClose={() => setOpenFileEditor(false)}
        />
      )}
      {openInfoEditor && (
        <EditInfoModal
          item={info}
          onClose={() => setOpenInfoEditor(false)}
          updateOverrideItem={updateOverrideItem}
        />
      )}
      {openLog && <ExecLogModal id={info.id} onClose={() => setOpenLog(false)} />}
      <Card
        fullWidth
        isPressable
        onPress={() => {
          if (disableOpen) return
          setOpenFileEditor(true)
        }}
      >
        <CardBody>
          <div className="flex justify-between h-[32px]">
            <h3
              ref={setNodeRef}
              {...attributes}
              {...listeners}
              className={`text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-[32px] text-foreground`}
            >
              {info?.name}
            </h3>
            <div className="flex">
              {info.type === 'remote' && (
                <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  color="default"
                  disabled={updating}
                  onPress={() => {
                    setUpdating(true)
                    addOverrideItem(info).finally(() => {
                      setUpdating(false)
                    })
                  }}
                >
                  <IoMdRefresh
                    color="default"
                    className={`text-[24px] ${updating ? 'animate-spin' : ''}`}
                  />
                </Button>
              )}

              <Dropdown>
                <DropdownTrigger>
                  <Button isIconOnly size="sm" variant="light" color="default">
                    <IoMdMore color="default" className={`text-[24px]`} />
                  </Button>
                </DropdownTrigger>
                <DropdownMenu onAction={onMenuAction}>
                  {menuItems.map((item) => (
                    <DropdownItem
                      showDivider={item.showDivider}
                      key={item.key}
                      color={item.color}
                      className={item.className}
                    >
                      {item.label}
                    </DropdownItem>
                  ))}
                </DropdownMenu>
              </Dropdown>
            </div>
          </div>
          <div className="flex justify-between">
            <div className={`mt-2 flex justify-start`}>
              <Chip size="sm" variant="bordered">
                {info.type === 'local' ? '本地' : '远程'}
              </Chip>
              <Chip size="sm" variant="bordered" className="ml-2">
                {info.ext === 'yaml' ? 'YAML' : 'JavaScript'}
              </Chip>
            </div>
            {info.type === 'remote' && (
              <div className={`mt-2 flex justify-end`}>
                <small>{dayjs(info.updated).fromNow()}</small>
              </div>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  )
}

export default OverrideItem
