export const defaultConfig: IAppConfig = {
  core: 'mihomo',
  silentStart: false,
  appTheme: 'system',
  useWindowFrame: false,
  proxyInTray: true,
  maxLogDays: 7,
  proxyCols: 'auto',
  connectionDirection: 'asc',
  connectionOrderBy: 'time',
  useSubStore: true,
  proxyDisplayMode: 'simple',
  proxyDisplayOrder: 'default',
  autoCheckUpdate: true,
  autoCloseConnection: true,
  useNameserverPolicy: false,
  controlDns: true,
  controlSniff: true,
  nameserverPolicy: {},
  siderOrder: [
    'sysproxy',
    'tun',
    'profile',
    'proxy',
    'rule',
    'resource',
    'override',
    'connection',
    'mihomo',
    'dns',
    'sniff',
    'log',
    'substore'
  ],
  sysProxy: { enable: false, mode: 'manual' }
}

export const defaultControledMihomoConfig: Partial<IMihomoConfig> = {
  'external-controller': '',
  ipv6: true,
  mode: 'rule',
  'mixed-port': 7890,
  'socks-port': 7891,
  port: 7892,
  'redir-port': 0,
  'tproxy-port': 0,
  'allow-lan': false,
  'unified-delay': false,
  'tcp-concurrent': false,
  'log-level': 'info',
  'find-process-mode': 'strict',
  'bind-address': '*',
  'lan-allowed-ips': ['0.0.0.0/0', '::/0'],
  'lan-disallowed-ips': [],
  authentication: [],
  'skip-auth-prefixes': ['127.0.0.1/32'],
  tun: {
    enable: false,
    device: 'Mihomo',
    stack: 'mixed',
    'auto-route': true,
    'auto-redirect': false,
    'auto-detect-interface': true,
    'dns-hijack': ['any:53'],
    mtu: 1500
  },
  dns: {
    enable: true,
    ipv6: false,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'fake-ip-filter': ['*', '+.lan', '+.local', 'time.*.com', 'ntp.*.com', '+.market.xiaomi.com'],
    'use-hosts': false,
    'use-system-hosts': false,
    nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query'],
    'proxy-server-nameserver': ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query']
  },
  sniffer: {
    enable: true,
    'parse-pure-ip': true,
    'force-dns-mapping': true,
    'override-destination': false,
    sniff: {
      HTTP: {
        ports: [80, 443],
        'override-destination': false
      },
      TLS: {
        ports: [443]
      },
      QUIC: {
        ports: [443]
      }
    },
    'skip-domain': ['+.push.apple.com']
  },
  profile: {
    'store-selected': true,
    'store-fake-ip': true
  },
  'geo-auto-update': false,
  'geo-update-interval': 24,
  'geodata-mode': false,
  'geox-url': {
    geoip: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat',
    geosite: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat',
    mmdb: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/country-lite.mmdb',
    asn: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb'
  }
}

export const defaultProfileConfig: IProfileConfig = {
  items: []
}

export const defaultOverrideConfig: IOverrideConfig = {
  items: []
}

export const defaultProfile: Partial<IMihomoConfig> = {
  proxies: [],
  'proxy-groups': [],
  rules: []
}
