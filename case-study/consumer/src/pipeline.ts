// Plain neverthrow: no typesugar syntax. Built both ways, it must behave
// the same; in Stage 1 typesugar leaves it as written.
import { err, ok, Result } from "neverthrow";

export type ParseError = { kind: "parse"; input: string } | { kind: "range"; value: number };
export type User = { id: number; name: string };

export const parse = (s: string): Result<number, ParseError> => {
  const n = Number(s);
  return Number.isNaN(n) ? err({ kind: "parse", input: s }) : ok(n);
};

export const validate = (n: number): Result<number, ParseError> =>
  n < 1000 ? ok(n) : err({ kind: "range", value: n });

export const toUser = (n: number): User => ({ id: n, name: `user${n}` });

export const toHttp = (e: ParseError): number => (e.kind === "parse" ? 400 : 422);

export const parseUser = (s: string): Result<User, ParseError> =>
  parse(s).andThen(validate).map(toUser);

export const describe = (r: Result<User, ParseError>): string =>
  r.match(
    (u) => `user ${u.id}`,
    (e) => `error ${e.kind}`
  );
