// The same functions as pipeline.ts, written with typesugar syntax over
// neverthrow's Result. Only compiles with typesugar.
import "@typesugar/std/syntax/do";
import { match } from "@typesugar/std";
import { Err, Ok, Result, ResultAsync, ok } from "neverthrow";
import { lookup, parse, validate, toUser, type ParseError, type User } from "./pipeline";

export function parseUserDo(s: string): Result<User, ParseError> {
  const r = let: {
    n << parse(s);
    v << validate(n);
  }
  yield: toUser(v);
  return r;
}

export const describeMatch = (r: Result<User, ParseError>): string =>
  match(r)
    .case(Ok(u))
    .then(`user ${u.id}`)
    .case(Err(e))
    .then(`error ${e.kind}`);

// A first step typed `Ok<number, never>` (what `ok()` returns), not `Result`
// (F7).
export function doubleChecked(n: number): Result<number, ParseError> {
  const r = let: {
    x << ok(n);
    y << validate(x * 2);
  }
  yield: y;
  return r;
}

// A first step typed through an alias of `Result` (F7).
type Parsed<T> = Result<T, ParseError>;
export function viaAlias(p: Parsed<number>): Parsed<string> {
  const r = let: {
    x << p;
  }
  yield: `#${x}`;
  return r;
}

// A class as a nested pattern (F8: `typesugar check` must not report it).
// The three arms cover every value, but the exhaustiveness check doesn't
// see through nested extractors over a union of classes, so it asks for a
// fallback (TS9226, F11).
export const nested = (r: Result<Result<number, string>, string>): string =>
  match(r)
    .case(Ok(Ok(v)))
    .then(`ok ${v}`)
    .case(Ok(Err(e)))
    .then(`inner ${e}`)
    .case(Err(e))
    .then(`outer ${e}`)
    .else("unreachable");

// Do-notation over ResultAsync (Stage 6), mixing a sync Result step.
export function userAsyncDo(s: string): ResultAsync<User, ParseError> {
  const r = let: {
    n << lookup(s);
    v << validate(n);
  }
  yield: toUser(v);
  return r;
}
