// Plain neverthrow: no typesugar syntax. Built both ways, it must behave
// the same; in Stage 1 typesugar leaves it as written.
import { err, errAsync, ok, okAsync, Result, ResultAsync, safeTry } from 'neverthrow'

export type ParseError = { kind: 'parse'; input: string } | { kind: 'range'; value: number }
export type User = { id: number; name: string }

export const parse = (s: string): Result<number, ParseError> => {
  const n = Number(s)
  return Number.isNaN(n) ? err({ kind: 'parse', input: s }) : ok(n)
}

export const validate = (n: number): Result<number, ParseError> =>
  n < 1000 ? ok(n) : err({ kind: 'range', value: n })

export const toUser = (n: number): User => ({ id: n, name: `user${n}` })

export const toHttp = (e: ParseError): number => (e.kind === 'parse' ? 400 : 422)

export const parseUser = (s: string): Result<User, ParseError> =>
  parse(s).andThen(validate).map(toUser)

export const describe = (r: Result<User, ParseError>): string =>
  r.match(
    (u) => `user ${u.id}`,
    (e) => `error ${e.kind}`,
  )

// Async: a lookup that may fail, then a validation (plain neverthrow).

export const lookup = (s: string): ResultAsync<number, ParseError> =>
  parse(s).asyncAndThen((n) => (n % 2 === 0 ? okAsync(n) : errAsync({ kind: 'range', value: n })))

export const userAsync = (s: string): ResultAsync<User, ParseError> =>
  lookup(s).andThen(validate).map(toUser)

export const userAsyncSafeTry = (s: string): ResultAsync<User, ParseError> =>
  safeTry(async function* () {
    const n = yield* lookup(s)
    const v = yield* validate(n)
    return ok(toUser(v))
  })
