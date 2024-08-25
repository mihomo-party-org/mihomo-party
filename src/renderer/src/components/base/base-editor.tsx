import { useEffect, useRef } from 'react'
import * as monaco from 'monaco-editor'
import MonacoEditor from 'react-monaco-editor'
import { configureMonacoYaml } from 'monaco-yaml'
import metaSchema from 'meta-json-schema/schemas/meta-json-schema.json'
import pac from 'types-pac/pac.d.ts?raw'
import { useTheme } from 'next-themes'
import { nanoid } from 'nanoid'
import React from 'react'
type Language = 'yaml' | 'javascript' | 'json'

interface Props {
  value: string
  readOnly?: boolean
  language: Language
  onChange?: (value: string) => void
}

let initialized = false
const monacoInitialization = (): void => {
  if (initialized) return

  // configure yaml worker
  configureMonacoYaml(monaco, {
    validate: true,
    enableSchemaRequest: true,
    schemas: [
      {
        uri: 'http://example.com/meta-json-schema.json',
        fileMatch: ['**/*.clash.yaml'],
        // @ts-ignore // type JSONSchema7
        schema: metaSchema
      }
    ]
  })
  // configure PAC definition
  monaco.languages.typescript.javascriptDefaults.addExtraLib(pac, 'pac.d.ts')
  initialized = true
}

export const BaseEditor: React.FC<Props> = (props) => {
  const { theme } = useTheme()

  const { value, readOnly = false, language, onChange } = props

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor>()

  const editorWillMount = (): void => {
    monacoInitialization()
  }

  const editorDidMount = (editor: monaco.editor.IStandaloneCodeEditor): void => {
    editorRef.current = editor

    const uri = monaco.Uri.parse(`${nanoid()}.${language === 'yaml' ? 'clash' : ''}.${language}`)
    const model = monaco.editor.createModel(value, language, uri)
    editorRef.current?.setModel(model)
  }

  useEffect(() => {
    window.onresize = (): void => {
      editorRef.current?.layout()
    }
    return (): void => {
      window.onresize = null
      editorRef.current?.dispose()
      editorRef.current = undefined
    }
  }, [])

  return (
    <MonacoEditor
      language={language}
      value={value}
      height="100%"
      theme={theme?.includes('light') ? 'vs' : 'vs-dark'}
      options={{
        tabSize: ['yaml', 'javascript', 'json'].includes(language) ? 2 : 4, // 根据语言类型设置缩进大小
        minimap: {
          enabled: document.documentElement.clientWidth >= 1500 // 超过一定宽度显示minimap滚动条
        },
        mouseWheelZoom: true, // 按住Ctrl滚轮调节缩放比例
        readOnly: readOnly, // 只读模式
        renderValidationDecorations: 'on', // 只读模式下显示校验信息
        quickSuggestions: {
          strings: true, // 字符串类型的建议
          comments: true, // 注释类型的建议
          other: true // 其他类型的建议
        },
        fontFamily: `Fira Code, JetBrains Mono, Roboto Mono, "Source Code Pro", Consolas, Menlo, Monaco, monospace, "Courier New", "Apple Color Emoji", "Noto Color Emoji"`,
        fontLigatures: true, // 连字符
        smoothScrolling: true // 平滑滚动
      }}
      editorWillMount={editorWillMount}
      editorDidMount={editorDidMount}
      onChange={onChange}
    />
  )
}
