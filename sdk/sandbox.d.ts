// songstress/sandbox: the globals an entry's code finds in Songstress's
// sandbox, and nothing more (SPEC.md, section 1, "The sandbox"). Name it in
// an extension's tsconfig.json:
//
//   "compilerOptions": { "lib": ["ES2023"], "types": ["songstress/sandbox"] }
//
// With the ES2023 library and these alone, code that reaches for `fetch`,
// `process`, `window` or `document` does not compile, which is the truth:
// they are not there. The way out is songstress.net.fetch.

/** The extension's log: `songstress dev` prints it, and the server keeps the
 * last of it for its admin. */
interface Console {
  log(...data: unknown[]): void
  info(...data: unknown[]): void
  warn(...data: unknown[]): void
  error(...data: unknown[]): void
  debug(...data: unknown[]): void
}

declare var console: Console

/** A timer does not keep a call alive past the promise its handler returned. */
declare function setTimeout(handler: (...args: never[]) => void, ms?: number, ...args: unknown[]): number
declare function setInterval(handler: (...args: never[]) => void, ms?: number, ...args: unknown[]): number
declare function clearTimeout(id: number | undefined): void
declare function clearInterval(id: number | undefined): void
