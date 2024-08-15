import {
  getControledMihomoConfig,
  getProfileConfig,
  getProfile,
  getProfileItem,
  getOverride
} from '../config'
import { mihomoWorkConfigPath } from '../utils/dirs'
import yaml from 'yaml'
import fs from 'fs'
import { readFile } from 'fs/promises'

export async function generateProfile(): Promise<void> {
  const { current } = await getProfileConfig()
  const currentProfile = await overrideProfile(current, await getProfile(current))
  const controledMihomoConfig = await getControledMihomoConfig()
  const { tun: profileTun = {} } = currentProfile
  const { tun: controledTun } = controledMihomoConfig
  const tun = Object.assign(profileTun, controledTun)
  const { dns: profileDns = {} } = currentProfile
  const { dns: controledDns } = controledMihomoConfig
  const dns = Object.assign(profileDns, controledDns)
  const { sniffer: profileSniffer = {} } = currentProfile
  const { sniffer: controledSniffer } = controledMihomoConfig
  const sniffer = Object.assign(profileSniffer, controledSniffer)
  const profile = Object.assign(currentProfile, controledMihomoConfig)
  profile.tun = tun
  profile.dns = dns
  profile.sniffer = sniffer
  return new Promise((resolve, reject) => {
    fs.writeFile(mihomoWorkConfigPath(), yaml.stringify(profile), (err) => {
      if (err) {
        reject(err)
      } else {
        resolve()
      }
    })
  })
}

async function overrideProfile(
  current: string | undefined,
  profile: IMihomoConfig
): Promise<IMihomoConfig> {
  const { override = [] } = (await getProfileItem(current)) || {}
  for (const ov of override) {
    const script = await getOverride(ov)
    profile = runOverrideScript(profile, script)
  }
  return profile
}

function runOverrideScript(profile: IMihomoConfig, script: string): IMihomoConfig {
  try {
    const func = eval(`${script} main`)
    const newProfile = func(profile)
    if (typeof newProfile !== 'object') return profile
    return newProfile
  } catch (e) {
    return profile
  }
}

export async function getRuntimeConfigStr(): Promise<string> {
  return await readFile(mihomoWorkConfigPath(), 'utf8')
}

export async function getRuntimeConfig(): Promise<IMihomoConfig> {
  return yaml.parse(await getRuntimeConfigStr())
}
