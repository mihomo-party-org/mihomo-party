import { getControledMihomoConfig, getCurrentProfile } from '../config'
import { mihomoWorkConfigPath } from '../utils/dirs'
import yaml from 'yaml'
import fs from 'fs'

export function generateProfile(): void {
  const currentProfile = getCurrentProfile()
  const controledMihomoConfig = getControledMihomoConfig()
  const { tun: profileTun = {} } = currentProfile
  const { tun: controledTun } = controledMihomoConfig
  const tun = Object.assign(profileTun, controledTun)
  const profile = Object.assign(currentProfile, controledMihomoConfig)
  console.log('profile', profile)
  profile.tun = tun
  fs.writeFileSync(mihomoWorkConfigPath(), yaml.stringify(profile))
}
