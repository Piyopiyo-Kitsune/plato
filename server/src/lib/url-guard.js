// SSRF defense for the link-attachment feature. The server fetches
// user-supplied URLs from inside AWS, so an unguarded fetch is a textbook
// server-side request forgery hole — a learner could point plato at
// `http://169.254.169.254/...` (the EC2/Lambda instance metadata endpoint) or
// at internal services. Every fetch (and every redirect hop) must pass through
// assertSafeUrl + assertSafeHost first.

import dns from 'node:dns/promises';
import net from 'node:net';

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);
// '' = default port (80/443). 8080 is a common public alt-HTTP port.
const ALLOWED_PORTS = new Set(['', '80', '443', '8080']);

/** A user-surfaceable failure. `status` is the HTTP code the route should return. */
export class LinkError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'LinkError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Validate the URL shape. Returns a parsed URL on success, throws LinkError.
 */
export function assertSafeUrl(rawUrl) {
  let u;
  try {
    u = new URL(rawUrl);
  } catch {
    throw new LinkError('invalid_url', "That doesn't look like a valid URL.");
  }
  if (!ALLOWED_PROTOCOLS.has(u.protocol)) {
    throw new LinkError('bad_scheme', 'Only http and https links are supported.');
  }
  if (u.username || u.password) {
    throw new LinkError('bad_url', 'URLs with embedded credentials are not allowed.');
  }
  if (!ALLOWED_PORTS.has(u.port)) {
    throw new LinkError('bad_port', 'That URL uses a port that is not allowed.');
  }
  return u;
}

function ipv4Blocked(ip) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true; // malformed — block defensively
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
  if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT (RFC 6598)
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking (RFC 2544)
  if (a >= 224) return true; // multicast (224+) + reserved (240+) + 255.255.255.255
  return false;
}

/** True if an IP literal points somewhere we must never fetch from. */
export function isBlockedIp(ip) {
  if (net.isIPv4(ip)) return ipv4Blocked(ip);
  if (net.isIPv6(ip)) {
    const lower = ip.toLowerCase();
    if (lower === '::1' || lower === '::') return true; // loopback, unspecified
    const v4mapped = lower.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (v4mapped) return ipv4Blocked(v4mapped[1]); // IPv4-mapped
    const head = lower.split(':')[0];
    if (/^f[cd]/.test(head)) return true; // fc00::/7 unique-local
    if (/^fe[89ab]/.test(head)) return true; // fe80::/10 link-local
    return false;
  }
  return true; // not a valid IP — block
}

/**
 * Resolve a hostname and reject if it (or any of its addresses) points at a
 * private/internal/reserved range. An IP literal is checked directly.
 */
export async function assertSafeHost(host) {
  if (net.isIP(host)) {
    if (isBlockedIp(host)) {
      throw new LinkError('blocked_host', 'That URL points to a private or internal address.');
    }
    return;
  }
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new LinkError('dns', "Couldn't resolve that website's address.");
  }
  if (!addrs.length) {
    throw new LinkError('dns', "Couldn't resolve that website's address.");
  }
  for (const { address } of addrs) {
    if (isBlockedIp(address)) {
      throw new LinkError('blocked_host', 'That URL points to a private or internal address.');
    }
  }
}
