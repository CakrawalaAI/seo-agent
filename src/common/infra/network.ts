// Network tuning for environments with flaky IPv6/DNS
try {
  // Always prefer IPv4 to avoid IPv6/DNS egress issues in provider SDKs
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const dns = require('dns') as typeof import('dns')
  if (typeof dns.setDefaultResultOrder === 'function') {
    dns.setDefaultResultOrder('ipv4first')
    try { import('@src/common/logger').then(({ log }) => log.info('[net] dns.setDefaultResultOrder(ipv4first) enabled')).catch(() => {}) } catch {}
  }
} catch {}
