import { parse as pslParse } from 'psl'

export function isLoopbackHost(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
}

export function isInternetHost(host: string): boolean {
  const parsed = pslParse(host)
  return 'listed' in parsed && parsed.listed === true
}

export function buildWellknownUrl(url: URL, name: string): URL {
  const path =
    url.pathname === '/'
      ? `/.well-known/${name}`
      : `${url.pathname.replace(/\/+$/, '')}/${name}`

  return new URL(path, url)
}