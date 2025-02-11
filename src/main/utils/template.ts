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
  siderWidth: 250,
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
  'unified-delay': true,
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
    'route-exclude-address': [],
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
    nameserver: ['https://120.53.53.53/dns-query', 'https://223.5.5.5/dns-query'],
    'proxy-server-nameserver': ['https://120.53.53.53/dns-query', 'https://223.5.5.5/dns-query'],
    'direct-nameserver': []
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
      }
    },
    'skip-domain': ['+.push.apple.com'],
    'skip-dst-address': [
      '91.105.192.0/23',
      '91.108.4.0/22',
      '91.108.8.0/21',
      '91.108.16.0/21',
      '91.108.56.0/22',
      '95.161.64.0/20',
      '149.154.160.0/20',
      '185.76.151.0/24',
      '2001:67c:4e8::/48',
      '2001:b28:f23c::/47',
      '2001:b28:f23f::/48',
      '2a0a:f280:203::/48'
    ]
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
    mmdb: 'https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.metadb',
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
