import React from 'react'
interface Props {
  title?: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  contentClassName?: string
}

const BasePage: React.FC<Props> = (props) => {
  return (
    <div className="w-full h-full overflow-y-auto custom-scrollbar">
      <div className="sticky top-0 z-40 h-[48px] w-full backdrop-blur bg-background/40">
        <div className="p-2 flex justify-between">
          <div className="select-none title h-full text-lg leading-[32px]">{props.title}</div>
          <div className="header h-full">{props.header}</div>
        </div>
      </div>
      <div className="content">{props.children}</div>
    </div>
  )
}

export default BasePage
