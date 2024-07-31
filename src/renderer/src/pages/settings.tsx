import { Button } from '@nextui-org/react'
import { mihomoVersion } from '@renderer/utils/api'

import useSWR from 'swr'

export default function Settings(): JSX.Element {
  const { data, error, isLoading, mutate } = useSWR('mihomoVersion', mihomoVersion)

  if (error) return <div>failed to load</div>
  if (isLoading) return <div>loading...</div>
  return (
    <div>
      {data?.version}
      <Button onPress={() => mutate()}>mutate</Button>
    </div>
  )
}
