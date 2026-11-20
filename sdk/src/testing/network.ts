// Whether a request may leave, as the manifest's `network` permission says
// and as the server's host judges it (apps/pocketbase/internal/extensions/
// host/netpolicy.go): over http or https, to a host the manifest names, by
// name or as every name under a domain ("*.example.com"), on the scheme's own
// port unless the pattern names one. An address is never a named host. A real
// server also checks what a name resolves to, on every hop; a test has no
// network to check.

/** The scheme, the host and the port of an address, when it writes one. */
const ADDRESS = /^(https?):\/\/(?:[^/?#@]*@)?(\[[^\]]*\]|[^:/?#]*)(?::(\d+))?/i

/** Each scheme's own port. */
const OWN_PORT: Readonly<Record<string, string>> = { http: '80', https: '443' }

/** An IPv4 or a bracketed IPv6 address, which no pattern names. */
const LITERAL = /^(?:\[.*\]|[\d.]+)$/

interface Target {
  readonly host: string
  /** The port the request goes to: the one written, else the scheme's own. */
  readonly port: string
  readonly ownPort: string
}

function targetOf(url: string): Target | undefined {
  const [, scheme, host, port] = ADDRESS.exec(url) ?? []
  if (scheme === undefined || !host) return undefined
  const ownPort = OWN_PORT[scheme.toLowerCase()] ?? ''
  return { host: host.toLowerCase(), port: port ?? ownPort, ownPort }
}

function fits(pattern: string, target: Target): boolean {
  const colon = pattern.lastIndexOf(':')
  const name = (colon < 0 ? pattern : pattern.slice(0, colon)).toLowerCase()
  const wanted = colon < 0 ? target.ownPort : pattern.slice(colon + 1)
  if (wanted !== target.port) return false
  // "*.example.com" is every name under the domain, and not the domain.
  return name.startsWith('*.') ? target.host.endsWith(name.slice(1)) : target.host === name
}

/** The host an address names, in lowercase; empty when it names none over http or https. */
export function hostOf(url: string): string {
  return targetOf(url)?.host ?? ''
}

/** Whether one of `hosts` takes the address. */
export function reaches(hosts: readonly string[], url: string): boolean {
  const target = targetOf(url)
  return target !== undefined && !LITERAL.test(target.host) && hosts.some((pattern) => fits(pattern, target))
}
