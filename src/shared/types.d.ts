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

interface ISysProxyConfig {
  enable: boolean
  mode?: 'auto' | 'manual'
  bypass?: string[]
  pacScript?: string
}

interface IAppConfig {
  core: 'mihomo' | 'mihomo-alpha'
  silentStart: boolean
  sysProxy: ISysProxyConfig
}

interface IMihomoTunConfig {
  enable: boolean
  stack?: 'system' | 'gvisor' | 'mixed'
  'auto-route'?: boolean
  'auto-redirect'?: boolean
  'auto-detect-interface'?: boolean
  'dns-hijack'?: string[]
  device?: string
  mtu?: number
  'strict-route'?: boolean
  gso?: boolean
  'gso-max-size'?: number
  'udp-timeout'?: number
  'iproute2-table-index'?: number
  'iproute2-rule-index'?: number
  'endpoint-independent-nat'?: boolean
  'route-address-set'?: string[]
  'route-exclude-address-set'?: string[]
  'route-address'?: string[]
  'route-exclude-address'?: string[]
  'include-interface'?: string[]
  'exclude-interface'?: string[]
  'include-uid'?: number[]
  'include-uid-range'?: string[]
  'exclude-uid'?: number[]
  'exclude-uid-range'?: string[]
  'include-android-user'?: string[]
  'include-package'?: string[]
  'exclude-package'?: string[]
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
  tun: IMihomoTunConfig
}

interface IProfileConfig {
  current?: string
  items: IProfileItem[]
}

interface IProfileItem {
  id: string
  type: 'remote' | 'local'
  name: string
  url?: string // remote
  file?: string // local
  updated?: number
  extra?: {
    upload: number
    download: number
    total: number
    expire: number
  }
}
