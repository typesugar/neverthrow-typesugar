// Consumer-side benchmark cases (CASE-STUDY.md, "Measuring the opt-in").
// Compiled ahead of time with `typesugar build` (CommonJS, into out/), so no
// loader runs in the bench process. Each case runs one input; run.mjs
// batches 1,000 inputs per task.
//
// The `*Hand` cases are written by hand as the code a typesugar feature
// would emit (Stage 2: a method chain compiled to branches, one Result
// allocated at the end). They measure the ceiling of that feature before
// anyone builds it.
import "@typesugar/std/syntax/do";
import { match } from "@typesugar/std";
import { Err, Ok, Result, ResultAsync, err, errAsync, fromThrowable, ok, okAsync, safeTry } from "neverthrow";

type E = { kind: "parse"; input: string } | { kind: "range"; value: number };
type User = { id: number; name: string };

const parse = (s: string): Result<number, E> => {
  const n = Number(s);
  return Number.isNaN(n) ? err({ kind: "parse", input: s }) : ok(n);
};
const validate = (n: number): Result<number, E> =>
  n < 1000 ? ok(n) : err({ kind: "range", value: n });
const toUser = (n: number): User => ({ id: n, name: "user" + n });
const toHttp = (e: E): number => (e.kind === "parse" ? 400 : 422);
const inc = (n: number) => n + 1;
const dbl = (n: number) => n * 2;
const sq = (n: number) => n * n;

// --- Stage 2 ceiling: a chain as methods, and as the branches it would compile to.

export const chainMethods = (s: string): Result<User, number> =>
  parse(s).andThen(validate).map(toUser).mapErr(toHttp);

export const chainHand = (s: string): Result<User, number> => {
  const a = parse(s);
  if (!("value" in a)) return err(toHttp(a.error));
  const b = validate(a.value);
  if (!("value" in b)) return err(toHttp(b.error));
  return ok(toUser(b.value));
};

export const map3Methods = (i: number): number =>
  ok<number, never>(i).map(inc).map(dbl).map(sq)._unsafeUnwrap();

export const map3Hand = (i: number): number => {
  const r = ok<number, never>(i);
  return "value" in r ? sq(dbl(inc(r.value))) : 0;
};

// --- Stage 4: safeTry against do-notation (compiles to andThen/map).

export const viaSafeTry = (s: string): Result<User, E> =>
  safeTry(function* () {
    const n = yield* parse(s);
    const v = yield* validate(n);
    return ok(toUser(v));
  });

export const viaDo = (s: string): Result<User, E> => {
  const r = let: {
    n << parse(s);
    v << validate(n);
  }
  yield: toUser(v);
  return r;
};

// --- Stage 3: .match() against match().

export const viaMatchMethod = (r: Result<User, E>): number =>
  r.match(
    (u) => u.id,
    (e) => (e.kind === "parse" ? -1 : -2)
  );

export const viaMatchMacro = (r: Result<User, E>): number =>
  match(r)
    .case(Ok(u))
    .then(u.id)
    .case(Err(e))
    .then(e.kind === "parse" ? -1 : -2);

// --- A busier program: Ok/Err methods called with many different callbacks
// at many sites, as an app's would be, before the timed tasks run.
export function pollute(): number {
  let x = 0;
  const fs = Array.from({ length: 32 }, (_, k) => new Function("n", `return n + ${k}`) as (n: number) => number);
  for (let round = 0; round < 2000; round++) {
    for (const f of fs) {
      x += ok<number, string>(round).map(f).andThen((n) => (n % 7 ? ok(n) : err("seven"))).unwrapOr(0);
      x += err<number, string>("e").map(f).mapErr((e) => e + f(1)).unwrapOr(0);
      x += ok<number, string>(round).match(f, () => 0);
    }
  }
  return x;
}

// --- Stage 6: async safeTry against do-notation over ResultAsync.
const lookup = (s: string): ResultAsync<number, E> =>
  parse(s).asyncAndThen((n) => (n % 2 === 0 ? okAsync(n) : errAsync({ kind: "range", value: n })));

export const viaSafeTryAsync = (s: string): ResultAsync<User, E> =>
  safeTry(async function* () {
    const n = yield* lookup(s);
    const v = yield* validate(n);
    return ok(toUser(v));
  });

export const viaDoAsync = (s: string): ResultAsync<User, E> => {
  const r = let: {
    n << lookup(s);
    v << validate(n);
  }
  yield: toUser(v);
  return r;
};

export const viaMethodsAsync = (s: string): ResultAsync<User, E> =>
  lookup(s).andThen(validate).map(toUser);

// --- Stage 5 ceiling: a fromThrowable wrapper against the inline try/catch a
// macro would emit. `lengthOf` throws for inputs starting with "x".
const lengthOf = (s: string): number => {
  if (s.charCodeAt(0) === 120) throw new Error("not a number: " + s);
  return s.length;
};
const safeLength = fromThrowable(lengthOf, (e) => (e as Error).message);

export const viaFromThrowable = (s: string): Result<number, string> => safeLength(s);

export const viaTryHand = (s: string): Result<number, string> => {
  try {
    return ok(lengthOf(s));
  } catch (e) {
    return err((e as Error).message);
  }
};
