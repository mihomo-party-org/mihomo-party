import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react'
import React, { useEffect, useState } from 'react'
import { BaseEditor } from '../base/base-editor'
import { getFileStr, setFileStr } from '@renderer/utils/ipc'
import yaml from 'js-yaml'
import { useTranslation } from 'react-i18next'
type Language = 'yaml' | 'javascript' | 'css' | 'json' | 'text'

interface Props {
  onClose: () => void
  path: string
  type: string
  title: string
  privderType: string
  format?: string
}
const Viewer: React.FC<Props> = (props) => {
  const { t } = useTranslation()
  const { type, path, title, format, privderType, onClose } = props
  const [currData, setCurrData] = useState('')
  let language: Language = !format || format === 'YamlRule' ? 'yaml' : 'text'

  const getContent = async (): Promise<void> => {
    let fileContent: React.SetStateAction<string>
    if (type === 'Inline') {
      fileContent = await getFileStr('config.yaml')
      language = 'yaml'
    } else {
      fileContent = await getFileStr(path)
    }
    try {
      const parsedYaml = yaml.load(fileContent)
      if (privderType === 'proxy-providers') {
        setCurrData(yaml.dump({
          'proxies': parsedYaml[privderType][title].payload
        }))
      } else {
        setCurrData(yaml.dump({
          'rules': parsedYaml[privderType][title].payload
        }))
      }
    } catch (error) {
      setCurrData(fileContent)
    }
  }

  useEffect(() => {
    getContent()
  }, [])

  return (
    <Modal
      backdrop="blur"
      classNames={{ backdrop: 'top-[48px]' }}
      size="5xl"
      hideCloseButton
      isOpen={true}
      onOpenChange={onClose}
      scrollBehavior="inside"
    >
      <ModalContent className="h-full w-[calc(100%-100px)]">
        <ModalHeader className="flex pb-0 app-drag">{title}</ModalHeader>
        <ModalBody className="h-full">
          <BaseEditor
            language={language}
            value={currData}
            readOnly={type != 'File'}
            onChange={(value) => setCurrData(value)}
          />
        </ModalBody>
        <ModalFooter className="pt-0">
          <Button size="sm" variant="light" onPress={onClose}>
            {t('common.close')}
          </Button>
          {type == 'File' && (
            <Button
              size="sm"
              color="primary"
              onPress={async () => {
                await setFileStr(path, currData)
                onClose()
              }}
            >
              {t('common.save')}
            </Button>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}

export default Viewer
