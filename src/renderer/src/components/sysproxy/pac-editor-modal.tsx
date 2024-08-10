import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react'
import React, { useState } from 'react'
import MonacoEditor, { monaco } from 'react-monaco-editor'
import { useTheme } from 'next-themes'
interface Props {
  script: string
  onCancel: () => void
  onConfirm: (script: string) => void
}
const PacEditorViewer: React.FC<Props> = (props) => {
  const { script, onCancel, onConfirm } = props
  const [currData, setCurrData] = useState(script)
  const { theme } = useTheme()

  const editorDidMount = (editor: monaco.editor.IStandaloneCodeEditor): void => {
    window.electron.ipcRenderer.on('resize', () => {
      editor.layout()
    })
  }

  const editorWillUnmount = (editor: monaco.editor.IStandaloneCodeEditor): void => {
    window.electron.ipcRenderer.removeAllListeners('resize')
    editor.dispose()
  }

  return (
    <Modal
      backdrop="blur"
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onCancel}
      scrollBehavior="inside"
    >
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex">编辑PAC脚本</ModalHeader>
        <ModalBody className="h-full">
          <MonacoEditor
            height="100%"
            language="javascript"
            value={currData}
            theme={theme === 'light' ? 'vs' : 'vs-dark'}
            options={{
              minimap: {
                enabled: false
              },
              mouseWheelZoom: true,
              fontFamily: `Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji", "Noto Color Empji"`,
              fontLigatures: true, // 连字符
              smoothScrolling: true // 平滑滚动
            }}
            editorDidMount={editorDidMount}
            editorWillUnmount={editorWillUnmount}
            onChange={(value) => setCurrData(value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onCancel}>
            取消
          </Button>
          <Button color="primary" onPress={() => onConfirm(currData)}>
            确认
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default PacEditorViewer
