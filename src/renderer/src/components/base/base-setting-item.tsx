import { Divider } from '@nextui-org/react'
import React from 'react'

interface Props {
  title: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
  divider?: boolean
}

const SettingItem: React.FC<Props> = (props) => {
  const { divider = false } = props

  return (
    <>
      <div className="h-[32px] w-full flex justify-between">
        <div className="h-full flex items-center">
          <h4 className="h-full select-none text-md leading-[32px]">{props.title}</h4>
          <div>{props.actions}</div>
        </div>
        {props.children}
      </div>
      {divider && <Divider className="my-2" />}
    </>
  )
}

export default SettingItem
