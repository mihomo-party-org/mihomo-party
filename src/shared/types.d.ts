type OutboundMode = 'rule' | 'global' | 'direct'

interface IMihomoVersion {
  version: string
  meta: boolean
}

interface IAppConfig {
  silentStart: boolean
}

interface IMihomoConfig {
  mode: OutboundMode
  'mixed-port': number
  'socks-port'?: number
  port?: number
}
