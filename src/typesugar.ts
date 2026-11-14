import type { Result } from './result'
import type { ResultAsync } from './result-async'

// typesugar instances for Result (typesugar case study, Stage 1).
//
// typesugar reads the JSDoc tags on these and compiles each use to plain code
// (a field test, a method call on the value), so the compiled code never
// calls them. They are still real values, so their types are honest: a plain
// TypeScript consumer that imports one gets a working object, and a bundler
// drops them when nothing imports them (case study F10).

/**
 * `match(r).case(Ok(v))`: compiles to `"value" in r` and `r.value`.
 *
 * @impl Destructure<typeof Ok, Result<unknown, unknown>, unknown>
 * @destructure has value -> value
 */
export const destructureOk = {
  extract: <T, E>(r: Result<T, E>): T | undefined => (r.isOk() ? r.value : undefined),
}

/**
 * `match(r).case(Err(e))`: compiles to `"error" in r` and `r.error`.
 *
 * @impl Destructure<typeof Err, Result<unknown, unknown>, unknown>
 * @destructure has error -> error
 */
export const destructureErr = {
  extract: <T, E>(r: Result<T, E>): E | undefined => (r.isErr() ? r.error : undefined),
}

/**
 * Do-notation (`let:`/`yield:`) over Result: compiles to `andThen` and `map`
 * calls on the values themselves.
 *
 * @impl FlatMap<Result>
 * @do-methods bind=andThen map=map
 */
export const flatMapResult = {
  map: <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> => r.map(f),
  flatMap: <T, U, E, F>(r: Result<T, E>, f: (t: T) => Result<U, F>): Result<U, E | F> =>
    r.andThen(f),
}

/**
 * Do-notation over ResultAsync: compiles to `andThen` and `map` calls on the
 * values, in place of `safeTry(async function* () { ... })`. A step may be a
 * Result or a ResultAsync, as `ResultAsync#andThen` accepts both.
 *
 * @impl FlatMap<ResultAsync>
 * @do-methods bind=andThen map=map
 */
export const flatMapResultAsync = {
  map: <T, U, E>(r: ResultAsync<T, E>, f: (t: T) => U): ResultAsync<U, E> => r.map(f),
  flatMap: <T, U, E, F>(
    r: ResultAsync<T, E>,
    f: (t: T) => Result<U, F> | ResultAsync<U, F>,
  ): ResultAsync<U, E | F> => r.andThen(f),
}
