import { Divider } from '@nextui-org/react'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import { platform } from '@renderer/utils/init'
import React, { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
interface Props {
  title?: React.ReactNode
  header?: React.ReactNode
  children?: React.ReactNode
  contentClassName?: string
}

const BasePage = forwardRef<HTMLDivElement, Props>((props, ref) => {
  const { appConfig } = useAppConfig()
  const { useWindowFrame = true } = appConfig || {}
  const [overlayWidth, setOverlayWidth] = React.useState(0)

  useEffect(() => {
    if (platform !== 'darwin' && !useWindowFrame) {
      try {
        // @ts-ignore windowControlsOverlay
        const windowControlsOverlay = window.navigator.windowControlsOverlay
        setOverlayWidth(window.innerWidth - windowControlsOverlay.getTitlebarAreaRect().width)
      } catch (e) {
        // ignore
      }
    }
  }, [])

  const contentRef = useRef<HTMLDivElement>(null)
  useImperativeHandle(ref, () => {
    return contentRef.current as HTMLDivElement
  })

  return (
    <div ref={contentRef} className="w-full h-full">
      <div className="sticky top-0 z-40 h-[49px] w-full bg-background">
        <div className="app-drag p-2 flex justify-between h-[48px]">
          <div className="title h-full text-lg leading-[32px]">{props.title}</div>
          <div style={{ marginRight: overlayWidth }} className="header h-full">
            {props.header}
          </div>
        </div>

        <Divider />
      </div>
      <div className="content h-[calc(100vh-49px)] overflow-y-auto custom-scrollbar">
        {props.children}
      </div>
    </div>
  )
})

BasePage.displayName = 'BasePage'
export default BasePage
