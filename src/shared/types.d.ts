type OutboundMode = 'rule' | 'global' | 'direct'
type LogLevel = 'info' | 'debug' | 'warn' | 'error' | 'silent'

interface IMihomoVersion {
  version: string
  meta: boolean
}

interface IAppConfig {
  core: 'mihomo' | 'mihomo-alpha'
  silentStart: boolean
}

interface IMihomoConfig {
  'external-controller': string
  secret?: string
  ipv6: boolean
  mode: OutboundMode
  'mixed-port': number
  'allow-lan': boolean
  'log-level': LogLevel
  'socks-port'?: number
  port?: number
  proxies?: []
  'proxy-groups'?: []
  rules?: []
}

interface IProfileConfig {
  current?: string
  profiles?: IProfileItem[]
}

interface IProfileItem {
  id: string
  type: 'remote' | 'local'
  name: string
}
