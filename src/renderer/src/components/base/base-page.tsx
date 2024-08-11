import { Divider } from '@nextui-org/react'
import React, { forwardRef, useImperativeHandle, useRef } from 'react'
interface Props {
  title?: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  contentClassName?: string
}

const BasePage = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const contentRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => {
    return contentRef.current as HTMLDivElement
  })

  return (
    <div ref={contentRef} className="w-full h-full overflow-y-auto custom-scrollbar">
      <div className="sticky top-0 z-40 h-[48px] w-full backdrop-blur bg-background/40">
        <div className="p-2 flex justify-between">
          <div className="title h-full text-lg leading-[32px]">{props.title}</div>
          <div className="header h-full">{props.header}</div>
        </div>
        <Divider />
      </div>
      <div className="content">{props.children}</div>
    </div>
  )
})

BasePage.displayName = 'BasePage'
export default BasePage
