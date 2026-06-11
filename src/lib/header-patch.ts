// Supabase JS 2.108 occasionally constructs Headers with values that contain
// characters > 0xFF (probably from a user metadata field bleeding into a
// header somewhere). The browser's Headers API rejects those, throwing
// "Failed to execute 'set' on 'Headers': String contains non ISO-8859-1
// code point." We patch the global Headers methods to silently strip any
// such chars before they reach the underlying implementation.

const NON_ISO = /[^\x00-\xFF]/g

const origSet = Headers.prototype.set
Headers.prototype.set = function (name: string, value: string) {
  return origSet.call(this, name, String(value).replace(NON_ISO, ''))
}

const origAppend = Headers.prototype.append
Headers.prototype.append = function (name: string, value: string) {
  return origAppend.call(this, name, String(value).replace(NON_ISO, ''))
}

// Constructor with an object/Map: clean values before delegating.
const OriginalHeaders = window.Headers
function PatchedHeaders(init?: HeadersInit) {
  if (init && typeof init === 'object' && !(init instanceof OriginalHeaders)) {
    if (Array.isArray(init)) {
      init = init.map(([k, v]) => [k, String(v).replace(NON_ISO, '')]) as [string, string][]
    } else {
      const cleaned: Record<string, string> = {}
      for (const [k, v] of Object.entries(init as Record<string, string>)) {
        cleaned[k] = String(v).replace(NON_ISO, '')
      }
      init = cleaned
    }
  }
  return new OriginalHeaders(init)
}
PatchedHeaders.prototype = OriginalHeaders.prototype
;(window as any).Headers = PatchedHeaders
