import { Button, Input } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import { useProfileConfig } from '@renderer/hooks/use-profile'
import { useState } from 'react'
import { MdContentPaste } from 'react-icons/md'

const Profiles: React.FC = () => {
  const { profileConfig, addProfileItem } = useProfileConfig()
  const [importing, setImporting] = useState(false)
  const [url, setUrl] = useState('')

  const handleImport = async (): Promise<void> => {
    setImporting(true)
    try {
      await addProfileItem({ name: 'Remote File', type: 'remote', url })
    } catch (e) {
      console.error(e)
    } finally {
      setImporting(false)
    }
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
        <Button size="sm" color="primary" isLoading={importing} onPress={handleImport}>
          导入
        </Button>
      </div>
      {JSON.stringify(profileConfig)}
    </BasePage>
  )
}

export default Profiles
