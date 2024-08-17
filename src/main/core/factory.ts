import {
  getControledMihomoConfig,
  getProfileConfig,
  getProfile,
  getProfileItem,
  getOverride,
  getOverrideItem
} from '../config'
import { mihomoWorkConfigPath } from '../utils/dirs'
import yaml from 'yaml'
import { readFile, writeFile } from 'fs/promises'
import { deepMerge } from '../utils/merge'

export async function generateProfile(): Promise<void> {
  const { current } = await getProfileConfig()
  const currentProfile = await overrideProfile(current, await getProfile(current))
  const controledMihomoConfig = await getControledMihomoConfig()
  const profile = deepMerge(currentProfile, controledMihomoConfig)
  await writeFile(mihomoWorkConfigPath(), yaml.stringify(profile))
}

async function overrideProfile(
  current: string | undefined,
  profile: IMihomoConfig
): Promise<IMihomoConfig> {
  const { override = [] } = (await getProfileItem(current)) || {}
  for (const ov of override) {
    const item = await getOverrideItem(ov)
    const content = await getOverride(ov, item?.ext || 'js')
    switch (item?.ext) {
      case 'js':
        profile = runOverrideScript(profile, content)
        break
      case 'yaml': {
        const patch = yaml.parse(content)
        if (patch.rules) {
          patch.rules = [...patch.rules, ...(profile.rules || [])]
        }
        if (patch.proxies) {
          patch.proxies = [...patch.proxies, ...(profile.proxies || [])]
        }
        if (patch['proxy-groups']) {
          patch['proxy-groups'] = [...patch['proxy-groups'], ...(profile['proxy-groups'] || [])]
        }
        profile = deepMerge(profile, patch)
        break
      }
    }
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
