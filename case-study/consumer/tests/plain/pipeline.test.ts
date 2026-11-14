import { Err, Ok } from 'neverthrow'
import { describe as group, expect, it } from 'vitest'
import { describe, parseUser, toHttp } from '../../src/pipeline'
import { inputs } from '../inputs'

group('plain neverthrow in the consumer', () => {
  it('parses users', () => {
    expect(parseUser('7')._unsafeUnwrap()).toEqual({ id: 7, name: 'user7' })
    expect(parseUser('x1')._unsafeUnwrapErr()).toEqual({ kind: 'parse', input: 'x1' })
    expect(parseUser('4500')._unsafeUnwrapErr()).toEqual({ kind: 'range', value: 4500 })
  })

  it('keeps the class representation', () => {
    for (const s of inputs) {
      const r = parseUser(s)
      expect(r instanceof Ok || r instanceof Err).toBe(true)
    }
  })

  it('describes and maps errors', () => {
    expect(describe(parseUser('7'))).toBe('user 7')
    expect(parseUser('x1').mapErr(toHttp)._unsafeUnwrapErr()).toBe(400)
  })
})

group('plain neverthrow, async', () => {
  it('andThen/map and async safeTry agree', async () => {
    const { userAsync, userAsyncSafeTry } = await import('../../src/pipeline')
    for (const s of inputs) expect(await userAsync(s)).toEqual(await userAsyncSafeTry(s))
    expect((await userAsync('8'))._unsafeUnwrap()).toEqual({ id: 8, name: 'user8' })
  })
})
