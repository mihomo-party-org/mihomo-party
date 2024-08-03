import { Button, Divider } from '@nextui-org/react'
import { FaChevronRight } from 'react-icons/fa'
import React from 'react'

interface Props {
  onPress?: () => void
  title: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  divider?: boolean
}

const SettingItem: React.FC<Props> = (props) => {
  const { title, actions, children, divider = false, onPress } = props
  if (onPress) {
    return (
      <>
        <div className="p-0 m-0 h-[32px] w-full flex justify-between">
          <h4 className="h-full select-none text-md leading-[32px]">{title}</h4>
          <Button size="sm" onPress={onPress}>
            <FaChevronRight />
          </Button>
        </div>
        {divider && <Divider className="my-2" />}
      </>
    )
  } else {
    return (
      <>
        <div className="h-[32px] w-full flex justify-between">
          <div className="h-full flex items-center">
            <h4 className="h-full select-none text-md leading-[32px]">{title}</h4>
            <div>{actions}</div>
          </div>
          {children}
        </div>
        {divider && <Divider className="my-2" />}
      </>
    )
  }
}

export default SettingItem
