// songstress/server: the extension API of the server entry, and the helpers
// a provider reaches its source with. The server's sandbox has no URL, no
// atob, no TextDecoder and no zlib (sandbox.d.ts): the helpers stand in for
// them, and for what every source's provider writes again (a retry, a
// failure Songstress understands, a token kept until it runs out, the one
// result of many that is the song asked for).

export * from './api/index'
export { serverApi as songstress } from './host'
export { API_VERSION } from './version'
export { base64Bytes, base64Text, utf8Text } from './helpers/bytes'
export { registerCatalog, type CatalogProvider } from './helpers/catalog'
export { gunzip } from './helpers/gunzip'
export { KeptValue } from './helpers/kept'
export { bestMatch, matchScore, type MatchTags } from './helpers/match'
export { fetchJson, fetchResponse, fetchText, findInAnswer, HttpStatusError, nullIfMissing } from './helpers/net'
export { foldText, htmlToText, unescapeHtml } from './helpers/text'
export { parseUrl, queryString, resolveUrl, urlParam, type ParsedUrl } from './helpers/url'
