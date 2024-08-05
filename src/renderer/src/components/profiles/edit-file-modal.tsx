import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@nextui-org/react'
import React, { useEffect, useState } from 'react'
import MonacoEditor, { monaco } from 'react-monaco-editor'
import { useTheme } from 'next-themes'
import { getProfileStr, setProfileStr } from '@renderer/utils/ipc'
interface Props {
  id: string
  onClose: () => void
}
const EditFileModal: React.FC<Props> = (props) => {
  const { id, onClose } = props
  const [currData, setCurrData] = useState('')
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

  const getContent = async (): Promise<void> => {
    setCurrData(await getProfileStr(id))
  }

  useEffect(() => {
    getContent()
  }, [])

  return (
    <Modal size="5xl" hideCloseButton isOpen={true} scrollBehavior="inside">
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex">编辑订阅</ModalHeader>
        <ModalBody className="h-full">
          <MonacoEditor
            height="100%"
            language="yaml"
            value={currData}
            theme={theme === 'dark' ? 'vs-dark' : 'vs'}
            options={{
              minimap: {
                enabled: false
              },
              mouseWheelZoom: true,
              fontFamily: `Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji"`,
              fontLigatures: true, // 连字符
              smoothScrolling: true // 平滑滚动
            }}
            editorDidMount={editorDidMount}
            editorWillUnmount={editorWillUnmount}
            onChange={(value) => setCurrData(value)}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="light" onPress={onClose}>
            取消
          </Button>
          <Button
            color="primary"
            onPress={async () => {
              await setProfileStr(id, currData)
              onClose()
            }}
          >
            确认
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default EditFileModal
