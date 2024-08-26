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
  Progress
} from '@nextui-org/react'
import { calcPercent, calcTraffic } from '@renderer/utils/calc'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import React, { Key, useEffect, useMemo, useState } from 'react'
import EditFileModal from './edit-file-modal'
import EditInfoModal from './edit-info-modal'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

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
  const [updating, setUpdating] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [openInfo, setOpenInfo] = useState(false)
  const [openFile, setOpenFile] = useState(false)
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
        setOpenInfo(true)
        break
      }
      case 'edit-file': {
        setOpenFile(true)
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
      {openFile && <EditFileModal id={info.id} onClose={() => setOpenFile(false)} />}
      {openInfo && (
        <EditInfoModal
          item={info}
          onClose={() => setOpenInfo(false)}
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
        <CardBody className="pb-1">
          <div className="flex justify-between h-[32px]">
            <h3
              ref={setNodeRef}
              {...attributes}
              {...listeners}
              className={`text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-[32px] ${isCurrent ? 'text-white' : 'text-foreground'}`}
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
                  title={dayjs(info.updated).fromNow()}
                  disabled={updating}
                  onPress={async () => {
                    setUpdating(true)
                    await addProfileItem(info)
                    setUpdating(false)
                  }}
                >
                  <IoMdRefresh
                    color="default"
                    className={`${isCurrent ? 'text-white' : 'text-foreground'} text-[24px] ${updating ? 'animate-spin' : ''}`}
                  />
                </Button>
              )}

              <Dropdown>
                <DropdownTrigger>
                  <Button isIconOnly size="sm" variant="light" color="default">
                    <IoMdMore
                      color="default"
                      className={`text-[24px] ${isCurrent ? 'text-white' : 'text-foreground'}`}
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
              className={`mt-2 flex justify-between ${isCurrent ? 'text-white' : 'text-foreground'}`}
            >
              <small>{`${calcTraffic(usage)}/${calcTraffic(total)}`}</small>
              <small>
                {extra.expire ? dayjs.unix(extra.expire).format('YYYY-MM-DD') : '长期有效'}
              </small>
            </div>
          )}
          {info.type === 'local' && (
            <div
              className={`mt-2 flex justify-between ${isCurrent ? 'text-white' : 'text-foreground'}`}
            >
              <Chip
                size="sm"
                variant="bordered"
                className={`${isCurrent ? 'text-white border-white' : 'border-primary text-primary'}`}
              >
                本地
              </Chip>
            </div>
          )}
        </CardBody>
        <CardFooter className="pt-0">
          {extra && (
            <Progress
              className="w-full"
              classNames={{
                indicator: isCurrent ? 'bg-white' : 'bg-foreground'
              }}
              value={calcPercent(extra?.upload, extra?.download, extra?.total)}
            />
          )}
        </CardFooter>
      </Card>
    </div>
  )
}

export default ProfileItem
