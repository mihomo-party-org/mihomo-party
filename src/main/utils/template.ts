export const defaultConfig: IAppConfig = {
  core: 'mihomo',
  silentStart: false,
  proxyDisplayMode: 'simple',
  proxyDisplayOrder: 'default',
  autoCheckUpdate: true,
  sysProxy: { enable: false, mode: 'manual' }
}

export const defaultControledMihomoConfig: Partial<IMihomoConfig> = {
  'external-controller': '127.0.0.1:9090',
  ipv6: false,
  mode: 'rule',
  'mixed-port': 7890,
  'allow-lan': false,
  'unified-delay': false,
  'log-level': 'info',
  'find-process-mode': 'strict',
  tun: {
    enable: false,
    device: 'Mihomo',
    stack: 'mixed',
    'auto-route': true,
    'auto-redirect': false,
    'auto-detect-interface': true,
    'dns-hijack': ['any:53'],
    mtu: 1500
  }
}

export const defaultProfileConfig: IProfileConfig = {
  items: []
}

export const defaultProfile: Partial<IMihomoConfig> = {
  proxies: [],
  'proxy-groups': [],
  rules: []
}
