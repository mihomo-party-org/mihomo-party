export const defaultConfig: IAppConfig = {
  core: 'mihomo',
  silentStart: false
}

export const defaultControledMihomoConfig: Partial<IMihomoConfig> = {
  'external-controller': '127.0.0.1:9090',
  ipv6: false,
  mode: 'rule',
  'mixed-port': 7890,
  'allow-lan': false,
  'log-level': 'info'
}

export const defaultProfileConfig: IProfileConfig = {
  current: 'default',
  profiles: [
    {
      id: 'default',
      type: 'local',
      name: '默认'
    }
  ]
}

export const defaultProfile: Partial<IMihomoConfig> = {
  proxies: [],
  'proxy-groups': [],
  rules: []
}
