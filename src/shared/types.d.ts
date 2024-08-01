type OutboundMode = 'rule' | 'global' | 'direct'
type LogLevel = 'info' | 'debug' | 'warn' | 'error' | 'silent'

interface IMihomoVersion {
  version: string
  meta: boolean
}

interface IMihomoTrafficInfo {
  up: number
  down: number
}

interface IMihomoRulesInfo {
  rules: IMihomoRulesDetail[]
}

interface IMihomoRulesDetail {
  type: string
  payload: string
  proxy: string
  size: number
}

interface IMihomoConnectionsInfo {
  downloadTotal: number
  uploadTotal: number
  connections?: IMihomoConnectionDetail[]
  memory: number
}

interface IMihomoConnectionDetail {
  id: string
  metadata: {
    network: 'tcp' | 'udp'
    type: string
    sourceIP: string
    destinationIP: string
    destinationGeoIP: string
    destinationIPASN: string
    sourcePort: string
    destinationPort: string
    inboundIP: string
    inboundPort: string
    inboundName: string
    inboundUser: string
    host: string
    dnsMode: string
    uid: number
    process: string
    processPath: string
    specialProxy: string
    specialRules: string
    remoteDestination: string
    dscp: number
    sniffHost: string
  }
  upload: number
  download: number
  start: string
  chains: string[]
  rule: string
  rulePayload: string
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
