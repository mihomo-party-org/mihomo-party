import React from 'react'
import { cn, Switch, SwitchProps } from '@nextui-org/react'

interface SiderSwitchProps extends SwitchProps {
  isShowBorder?: boolean
}

const SiderSwitch: React.FC<SiderSwitchProps> = (props) => {
  const { isShowBorder = false, isSelected, classNames, ...switchProps } = props

  return (
    <Switch
      classNames={{
        wrapper: cn('border-2', {
          'border-transparent': !isShowBorder
        }),
        thumb: cn('absolute z-4', { 'transform -translate-x-[2px]': isSelected }),
        ...classNames
      }}
      size="sm"
      {...switchProps}
    />
  )
}

export default SiderSwitch
