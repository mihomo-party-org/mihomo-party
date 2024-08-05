import {
  Button,
  Card,
  CardBody,
  CardFooter,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Progress
} from '@nextui-org/react'
import { calcPercent, calcTraffic } from '@renderer/utils/calc'
import { IoMdMore, IoMdRefresh } from 'react-icons/io'
import dayjs from 'dayjs'
import React, { Key, useMemo, useState } from 'react'
import EditFileModal from './edit-file-modal'
import EditInfoModal from './edit-info-modal'

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
  const [openInfo, setOpenInfo] = useState(false)
  const [openFile, setOpenFile] = useState(false)

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

  const onMenuAction = (key: Key): void => {
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
        removeProfileItem(info.id)
        mutateProfileConfig()
        break
      }

      case 'home': {
        open(info.home)
        break
      }
    }
  }

  return (
    <>
      {openFile && <EditFileModal id={info.id} onClose={() => setOpenFile(false)} />}
      {openInfo && (
        <EditInfoModal
          item={info}
          onClose={() => setOpenInfo(false)}
          updateProfileItem={updateProfileItem}
        />
      )}
      <Card fullWidth isPressable onPress={onClick} className={isCurrent ? 'bg-primary' : ''}>
        <CardBody className="pb-1">
          <div className="flex justify-between h-[32px]">
            <h3 className="select-none text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-[32px]">
              {info?.name}
            </h3>
            <div className="flex">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="default"
                disabled={updating}
                onPress={() => {
                  setUpdating(true)
                  addProfileItem(info).finally(() => {
                    setUpdating(false)
                  })
                }}
              >
                <IoMdRefresh
                  color="default"
                  className={`text-[24px] ${updating ? 'animate-spin' : ''}`}
                />
              </Button>
              <Dropdown>
                <DropdownTrigger>
                  <Button isIconOnly size="sm" variant="light" color="default">
                    <IoMdMore color="default" className="text-[24px]" />
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
          <div className="mt-2 flex justify-between">
            <small>{extra ? `${calcTraffic(usage)}/${calcTraffic(total)}` : undefined}</small>
            <small>{dayjs(info.updated).fromNow()}</small>
          </div>
        </CardBody>
        <CardFooter className="pt-0">
          {extra && (
            <Progress
              className="w-full"
              classNames={{ indicator: 'bg-foreground', label: 'select-none' }}
              value={calcPercent(extra?.upload, extra?.download, extra?.total)}
            />
          )}
        </CardFooter>
      </Card>
    </>
  )
}

export default ProfileItem
