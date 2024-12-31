import React from 'react'
import { cn, Switch, SwitchProps } from '@nextui-org/react'
import './border-switch.css'

interface SiderSwitchProps extends SwitchProps {
  isShowBorder?: boolean
}

const BorderSwitch: React.FC<SiderSwitchProps> = (props) => {
  const { isShowBorder = false, classNames, ...switchProps } = props

  return (
    <Switch
      className="border-switch px-[8px]"
      classNames={{
        wrapper: cn('border-2', {
          'border-transparent': !isShowBorder,
          'border-primary-foreground': isShowBorder
        }),
        thumb: cn('absolute z-4', 'transform -translate-x-[2px]'),
        ...classNames
      }}
      size="sm"
      {...switchProps}
    />
  )
}

export default BorderSwitch
