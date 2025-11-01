// Network tuning for environments with flaky IPv6/DNS
// Enable by setting `SEOA_IPV4_FIRST=1`
try {
  // Default: prefer IPv4 to avoid IPv6/DNS egress issues in provider SDKs
  // Can be disabled by setting SEOA_IPV4_FIRST=0 explicitly
  if (String(process.env.SEOA_IPV4_FIRST || '1') !== '0') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const dns = require('dns') as typeof import('dns')
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first')
      console.info('[net] dns.setDefaultResultOrder(ipv4first) enabled (default)')
    }
  }
} catch {}
