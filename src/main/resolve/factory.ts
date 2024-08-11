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

export function generateProfile(): void {
  const current = getProfileConfig().current
  const currentProfile = overrideProfile(current, getProfile(current))
  const controledMihomoConfig = getControledMihomoConfig()
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
  fs.writeFileSync(mihomoWorkConfigPath(), yaml.stringify(profile))
}

function overrideProfile(current: string | undefined, profile: IMihomoConfig): IMihomoConfig {
  const overrideScriptList = getProfileItem(current).override || []
  for (const override of overrideScriptList) {
    const script = getOverride(override)
    profile = runOverrideScript(profile, script)
  }
  return profile
}

function runOverrideScript(profile: IMihomoConfig, script: string): IMihomoConfig {
  try {
    const func = eval(`${script} main`)
    const newProfile = func(profile)
    if (typeof newProfile !== 'object') {
      throw new Error('Override script must return an object')
    }
    return newProfile
  } catch (e) {
    return profile
  }
}
