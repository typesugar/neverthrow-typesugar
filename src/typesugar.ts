import type { Result } from './result'

// typesugar instances for Result (typesugar case study, Stage 1).
//
// These are declarations only: they exist in `index.d.ts` and emit no
// JavaScript. typesugar reads the JSDoc tags from the declarations and
// compiles each use to plain code (a field test, a method call), so it never
// references the instance values at runtime. Plain TypeScript consumers see
// three extra exported declarations and nothing else.

/**
 * `match(r).case(Ok(v))`: compiles to `"value" in r` and `r.value`.
 *
 * @impl Destructure<typeof Ok, Result<unknown, unknown>, unknown>
 * @destructure has value -> value
 */
export declare const destructureOk: {
  extract<T, E>(r: Result<T, E>): T | undefined
}

/**
 * `match(r).case(Err(e))`: compiles to `"error" in r` and `r.error`.
 *
 * @impl Destructure<typeof Err, Result<unknown, unknown>, unknown>
 * @destructure has error -> error
 */
export declare const destructureErr: {
  extract<T, E>(r: Result<T, E>): E | undefined
}

/**
 * Do-notation (`let:`/`yield:`) over Result: compiles to `andThen` and `map`
 * calls on the values themselves.
 *
 * @impl FlatMap<Result>
 * @do-methods bind=andThen map=map
 */
export declare const flatMapResult: {
  map<T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E>
  flatMap<T, U, E, F>(r: Result<T, E>, f: (t: T) => Result<U, F>): Result<U, E | F>
}
