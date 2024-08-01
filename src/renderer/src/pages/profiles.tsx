import { Button, Input } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import { useState } from 'react'
import { MdContentPaste } from 'react-icons/md'

const Profiles: React.FC = () => {
  const [url, setUrl] = useState('')

  const handleImport = async (): Promise<void> => {
    console.log('import', url)
  }
  return (
    <BasePage title="订阅">
      <div className="flex m-2">
        <Input
          variant="bordered"
          className="mr-2"
          size="sm"
          value={url}
          onValueChange={setUrl}
          endContent={
            <Button
              size="sm"
              isIconOnly
              variant="light"
              onPress={() => {
                navigator.clipboard.readText().then((text) => {
                  setUrl(text)
                })
              }}
            >
              <MdContentPaste className="text-lg" />
            </Button>
          }
        />
        <Button size="sm" color="primary" onPress={handleImport}>
          导入
        </Button>
      </div>
    </BasePage>
  )
}

export default Profiles
