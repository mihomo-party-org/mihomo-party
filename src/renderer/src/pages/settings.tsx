import { Button } from '@nextui-org/react'
import { checkAutoRun, enableAutoRun, disableAutoRun } from '@renderer/utils/api'

import useSWR from 'swr'

export default function Settings(): JSX.Element {
  const { data, error, isLoading, mutate } = useSWR('checkAutoRun', checkAutoRun, {
    errorRetryCount: 5,
    errorRetryInterval: 200
  })

  if (error) return <div>failed to load</div>
  if (isLoading) return <div>loading...</div>
  return (
    <div>
      {`${data}`}
      <Button
        onPress={async () => {
          await enableAutoRun()
          await mutate()
        }}
      >
        enable
      </Button>
      <Button
        onPress={async () => {
          await disableAutoRun()
          await mutate()
        }}
      >
        disable
      </Button>
    </div>
  )
}
