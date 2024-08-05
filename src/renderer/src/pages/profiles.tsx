import { Button, Input } from '@nextui-org/react'
import BasePage from '@renderer/components/base/base-page'
import ProfileItem from '@renderer/components/profiles/profile-item'
import { useProfileConfig } from '@renderer/hooks/use-profile-config'
import { useState } from 'react'
import { MdContentPaste } from 'react-icons/md'

const Profiles: React.FC = () => {
  const {
    profileConfig,
    addProfileItem,
    updateProfileItem,
    removeProfileItem,
    changeCurrentProfile,
    mutateProfileConfig
  } = useProfileConfig()
  const { current, items } = profileConfig || {}
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
    <BasePage title="订阅管理">
      <div className="sticky top-[48px] z-40 backdrop-blur bg-background/40 flex p-2">
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
      <div className="grid sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 mx-2">
        {items?.map((item) => (
          <ProfileItem
            key={item.id}
            isCurrent={item.id === current}
            addProfileItem={addProfileItem}
            removeProfileItem={removeProfileItem}
            mutateProfileConfig={mutateProfileConfig}
            updateProfileItem={updateProfileItem}
            info={item}
            onClick={async () => {
              await changeCurrentProfile(item.id)
            }}
          />
        ))}
      </div>
    </BasePage>
  )
}

export default Profiles
