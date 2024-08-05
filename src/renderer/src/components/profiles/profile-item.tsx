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
import React, { Key, useMemo } from 'react'

interface Props {
  info: IProfileItem
  isCurrent: boolean
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
  const { info, removeProfileItem, mutateProfileConfig, onClick, isCurrent } = props
  const extra = info?.extra
  const usage = (extra?.upload ?? 0) + (extra?.download ?? 0)
  const total = extra?.total ?? 0

  const menuItems: MenuItem[] = useMemo(() => {
    const list = [
      {
        key: 'edit',
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
      case 'edit':
        break
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
    <Card fullWidth isPressable onPress={onClick} className={isCurrent ? 'bg-primary' : ''}>
      <CardBody className="pb-1">
        <div className="flex justify-between h-[32px]">
          <h3 className="select-none text-ellipsis whitespace-nowrap overflow-hidden text-md font-bold leading-[32px]">
            {info?.name}
          </h3>
          <div className="flex">
            <Button isIconOnly size="sm" variant="light" color="default">
              <IoMdRefresh color="default" className="text-[24px]" />
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
  )
}

export default ProfileItem
