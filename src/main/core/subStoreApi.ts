import axios from 'axios'
import { subStorePort } from '../resolve/server'

export async function subStoreSubs(): Promise<ISubStoreSub[]> {
  const res = await axios.get(`http://127.0.0.1:${subStorePort}/api/subs`)

  return res.data.data as ISubStoreSub[]
}

export async function subStoreCollections(): Promise<ISubStoreSub[]> {
  const res = await axios.get(`http://127.0.0.1:${subStorePort}/api/collections`)

  return res.data.data as ISubStoreSub[]
}
