import { getControledMihomoConfig, getProfileConfig, getProfile } from '../config'
import { mihomoWorkConfigPath } from '../utils/dirs'
import yaml from 'yaml'
import fs from 'fs'

export function generateProfile(): void {
  const current = getProfileConfig().current
  const currentProfile = getProfile(current)
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
