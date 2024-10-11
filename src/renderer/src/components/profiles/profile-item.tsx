import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Chip,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Progress,
  Tooltip
} from '@nextui-org/react'
import { calcPercent, calcTraffic } from '@renderer/utils/calc'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import React, { Key, useEffect, useMemo, useState } from 'react'
import EditFileModal from './edit-file-modal'
import EditInfoModal from './edit-info-modal'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { openFile } from '@renderer/utils/ipc'
import { useAppConfig } from '@renderer/hooks/use-app-config'

interface Props {
  info: IProfileItem
  isCurrent: boolean
  addProfileItem: (item: Partial<IProfileItem>) => Promise<void>
  updateProfileItem: (item: IProfileItem) => Promise<void>
  removeProfileItem: (id: string) => Promise<void>
  mutateProfileConfig: () => void
  onClick: () => Promise<void>
}

interface MenuItem {
  key: string
  label: string
  showDivider: boolean
  color: 'default' | 'danger'
  className: string
}
const ProfileItem: React.FC<Props> = (props) => {
  const {
    info,
    addProfileItem,
    removeProfileItem,
    mutateProfileConfig,
    updateProfileItem,
    onClick,
    isCurrent
  } = props
  const extra = info?.extra
  const usage = (extra?.upload ?? 0) + (extra?.download ?? 0)
  const total = extra?.total ?? 0
  const { appConfig, patchAppConfig } = useAppConfig()
  const { profileDisplayDate = 'expire' } = appConfig || {}
  const [updating, setUpdating] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [openInfoEditor, setOpenInfoEditor] = useState(false)
  const [openFileEditor, setOpenFileEditor] = useState(false)
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
  const [disableSelect, setDisableSelect] = useState(false)

  const menuItems: MenuItem[] = useMemo(() => {
    const list = [
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
    if (info.home) {
      list.unshift({
        key: 'home',
        label: '主页',
        showDivider: false,
        color: 'default',
        className: ''
      } as MenuItem)
    }
    return list
  }, [info])

  const onMenuAction = async (key: Key): Promise<void> => {
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
        openFile('profile', info.id)
        break
      }
      case 'delete': {
        await removeProfileItem(info.id)
        mutateProfileConfig()
        break
      }

      case 'home': {
        open(info.home)
        break
      }
    }
  }

  useEffect(() => {
    if (isDragging) {
      setTimeout(() => {
        setDisableSelect(true)
      }, 200)
    } else {
      setTimeout(() => {
        setDisableSelect(false)
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
      {openFileEditor && <EditFileModal id={info.id} onClose={() => setOpenFileEditor(false)} />}
      {openInfoEditor && (
        <EditInfoModal
          item={info}
          onClose={() => setOpenInfoEditor(false)}
          updateProfileItem={updateProfileItem}
        />
      )}
      <Card
        fullWidth
        isPressable
        onPress={() => {
          if (disableSelect) return
          setSelecting(true)
          onClick().finally(() => {
            setSelecting(false)
          })
        }}
        className={`${isCurrent ? 'bg-primary' : ''} ${selecting ? 'blur-sm' : ''}`}
      >
        <div ref={setNodeRef} {...attributes} {...listeners} className="w-full h-full">
          <CardBody className="pb-1">
            <div className="flex justify-between h-[32px]">
              <h3
                title={info?.name}
                className={`text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-[32px] ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                {info?.name}
              </h3>
              <div className="flex">
                {info.type === 'remote' && (
                  <Tooltip placement="left" content={dayjs(info.updated).fromNow()}>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="light"
                      color="default"
                      disabled={updating}
                      onPress={async () => {
                        setUpdating(true)
                        await addProfileItem(info)
                        setUpdating(false)
                      }}
                    >
                      <IoMdRefresh
                        color="default"
                        className={`${isCurrent ? 'text-primary-foreground' : 'text-foreground'} text-[24px] ${updating ? 'animate-spin' : ''}`}
                      />
                    </Button>
                  </Tooltip>
                )}

                <Dropdown>
                  <DropdownTrigger>
                    <Button isIconOnly size="sm" variant="light" color="default">
                      <IoMdMore
                        color="default"
                        className={`text-[24px] ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                      />
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
            {info.type === 'remote' && extra && (
              <div
                className={`mt-2 flex justify-between ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                <small>{`${calcTraffic(usage)}/${calcTraffic(total)}`}</small>
                {profileDisplayDate === 'expire' ? (
                  <Button
                    size="sm"
                    variant="light"
                    className={`h-[20px] p-1 m-0 ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                    onPress={async () => {
                      await patchAppConfig({ profileDisplayDate: 'update' })
                    }}
                  >
                    {extra.expire ? dayjs.unix(extra.expire).format('YYYY-MM-DD') : '长期有效'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="light"
                    className={`h-[20px] p-1 m-0 ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
                    onPress={async () => {
                      await patchAppConfig({ profileDisplayDate: 'expire' })
                    }}
                  >
                    {dayjs(info.updated).fromNow()}
                  </Button>
                )}
              </div>
            )}
          </CardBody>
          <CardFooter className="pt-0">
            {info.type === 'remote' && !extra && (
              <div
                className={`w-full mt-2 flex justify-between ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                <Chip
                  size="sm"
                  variant="bordered"
                  className={`${isCurrent ? 'text-primary-foreground border-primary-foreground' : 'border-primary text-primary'}`}
                >
                  远程
                </Chip>
                <small>{dayjs(info.updated).fromNow()}</small>
              </div>
            )}
            {info.type === 'local' && (
              <div
                className={`mt-2 flex justify-between ${isCurrent ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                <Chip
                  size="sm"
                  variant="bordered"
                  className={`${isCurrent ? 'text-primary-foreground border-primary-foreground' : 'border-primary text-primary'}`}
                >
                  本地
                </Chip>
              </div>
            )}
            {extra && (
              <Progress
                className="w-full"
                classNames={{
                  indicator: isCurrent ? 'bg-primary-foreground' : 'bg-foreground'
                }}
                value={calcPercent(extra?.upload, extra?.download, extra?.total)}
              />
            )}
          </CardFooter>
        </div>
      </Card>
    </div>
  )
}

export default ProfileItem
