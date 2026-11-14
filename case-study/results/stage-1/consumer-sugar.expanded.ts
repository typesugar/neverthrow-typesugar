// The same functions as pipeline.ts, written with typesugar syntax over
// neverthrow's Result. Only compiles with typesugar.
import "@typesugar/std/syntax/do";
import { Err, Ok, Result, ok } from "neverthrow";
import { parse, validate, toUser, type ParseError, type User } from "./pipeline";
export function parseUserDo(s: string): Result<User, ParseError> {
    const r = parse(s).andThen(n => validate(n).map(v => toUser(v)));
    return r;
}
export const describeMatch = (r: Result<User, ParseError>): string => (() => {
    const _r = r;
    if ("value" in _r) {
        const u = _r.value;
        return `user ${u.id}`;
    }
    const e = _r.error;
    return `error ${e.kind}`;
})();
// A first step typed `Ok<number, never>` (what `ok()` returns), not `Result`
// (F7).
export function doubleChecked(n: number): Result<number, ParseError> {
    const r = ok(n).andThen(x => validate(x * 2).map(y => y));
    return r;
}
// A first step typed through an alias of `Result` (F7).
type Parsed<T> = Result<T, ParseError>;
export function viaAlias(p: Parsed<number>): Parsed<string> {
    const r = p.map(x => `#${x}`);
    return r;
}
// A class as a nested pattern (F8: `typesugar check` must not report it).
// The three arms cover every value, but the exhaustiveness check doesn't
// see through nested extractors over a union of classes, so it asks for a
// fallback (TS9226, F11).
export const nested = (r: Result<Result<number, string>, string>): string => (() => {
    const __typesugar__r_s4_0__ = r;
    if ("value" in __typesugar__r_s4_0__ && (__typesugar__r_s4_0__.value != null && typeof __typesugar__r_s4_0__.value === "object" && "value" in __typesugar__r_s4_0__.value)) {
        const v = __typesugar__r_s4_0__.value.value;
        return `ok ${v}`;
    }
    if ("value" in __typesugar__r_s4_0__ && (__typesugar__r_s4_0__.value != null && typeof __typesugar__r_s4_0__.value === "object" && "error" in __typesugar__r_s4_0__.value)) {
        const e = __typesugar__r_s4_0__.value.error;
        return `inner ${e}`;
    }
    if ("error" in __typesugar__r_s4_0__) {
        const e = __typesugar__r_s4_0__.error;
        return `outer ${e}`;
    }
    return "unreachable";
})();

