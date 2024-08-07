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
  'socks-port': 7891,
  port: 7892,
  'redir-port': 0,
  'tproxy-port': 0,
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
  },
  dns: {
    enable: false,
    ipv6: false,
    'enhanced-mode': 'fake-ip',
    'fake-ip-range': '198.18.0.1/16',
    'fake-ip-filter': ['*', '+.lan', '+.local', 'time.*.com', 'ntp.*.com', '+.market.xiaomi.com'],
    'use-hosts': false,
    'use-system-hosts': false,
    nameserver: ['https://doh.pub/dns-query', 'https://dns.alidns.com/dns-query']
  },
  sniffer: {
    enable: true,
    'parse-pure-ip': false,
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
