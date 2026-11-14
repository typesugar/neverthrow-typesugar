// typesugar syntax over neverthrow's Result gives the same answers as the
// plain API, on the same class instances.
import { Err, Ok, err, ok } from 'neverthrow'
import { describe as group, expect, it } from 'vitest'
import { describe, parseUser } from '../../src/pipeline'
import { describeMatch, doubleChecked, nested, parseUserDo, viaAlias } from '../../src/sugar'
import { inputs } from '../inputs'

group('typesugar syntax over neverthrow', () => {
  it('let: gives the same Result as andThen/map', () => {
    for (const s of inputs) expect(parseUserDo(s)).toEqual(parseUser(s))
  })

  it("let: returns neverthrow's own classes", () => {
    expect(parseUserDo('7')).toBeInstanceOf(Ok)
    expect(parseUserDo('x1')).toBeInstanceOf(Err)
  })

  it('match() gives the same answer as .match()', () => {
    for (const s of inputs) expect(describeMatch(parseUser(s))).toBe(describe(parseUser(s)))
  })

  it('match() takes Results built by plain code', () => {
    expect(describeMatch(ok({ id: 1, name: 'a' }))).toBe('user 1')
    expect(describeMatch(err({ kind: 'parse', input: 'q' }))).toBe('error parse')
  })
})

group('F7, F8: binds typed Ok<…> or an alias, nested class patterns', () => {
  it('let: whose first step is ok(…)', () => {
    expect(doubleChecked(7)).toEqual(ok(14))
    expect(doubleChecked(600)._unsafeUnwrapErr()).toEqual({ kind: 'range', value: 1200 })
  })

  it('let: over an alias of Result', () => {
    expect(viaAlias(ok(3))).toEqual(ok('#3'))
    expect(viaAlias(err({ kind: 'parse', input: 'q' }))._unsafeUnwrapErr().kind).toBe('parse')
  })

  it('nested Ok/Err patterns', () => {
    expect(nested(ok(ok(1)))).toBe('ok 1')
    expect(nested(ok(err('a')))).toBe('inner a')
    expect(nested(err('b'))).toBe('outer b')
  })
})

group('Stage 6: let: over ResultAsync', () => {
  it('gives the same Result as andThen/map and as async safeTry', async () => {
    const { userAsync, userAsyncSafeTry } = await import('../../src/pipeline')
    const { userAsyncDo } = await import('../../src/sugar')
    for (const s of inputs) {
      const viaDo = await userAsyncDo(s)
      expect(viaDo).toEqual(await userAsync(s))
      expect(viaDo).toEqual(await userAsyncSafeTry(s))
    }
  })

  it('returns a ResultAsync', async () => {
    const { userAsyncDo } = await import('../../src/sugar')
    const { ResultAsync } = await import('neverthrow')
    expect(userAsyncDo('8')).toBeInstanceOf(ResultAsync)
  })
})
