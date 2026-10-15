// The HTTP API has no authentication, so we need to make sure that requests actually come from a
// program running on this machine, and not from a web page that the user happens to be visiting.
// - Checking `Host` prevents DNS rebinding, where an attacker controlled domain name is made to
//   resolve to 127.0.0.1 so that their page becomes same-origin with us.
// - Checking `Origin` prevents CSRF. Browsers always send `Origin` on cross origin requests (and on
//   all POSTs), while non-browser clients like curl never send it.
// eslint-disable-next-line import/prefer-default-export
export function isRequestAllowed({ host, origin, port }: {
  host: string | undefined,
  origin: string | undefined,
  port: number,
}) {
  if (origin != null) return false;
  if (host == null) return false;
  const allowedHosts = ['127.0.0.1', 'localhost', '[::1]'];
  const hostLower = host.toLowerCase();
  // a browser omits the port from `Host` when it's the default port for the scheme
  return allowedHosts.some((allowedHost) => hostLower === `${allowedHost}:${port}` || (port === 80 && hostLower === allowedHost));
}
