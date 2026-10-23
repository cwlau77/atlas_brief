import { describe, expect, it } from 'vitest'
import { readNdjson } from './ndjson'

const stream = (chunks: string[]) => {
  const bytes = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of chunks) controller.enqueue(bytes.encode(c))
      controller.close()
    },
  })
}

const collect = async (chunks: string[]) => {
  const out: unknown[] = []
  for await (const value of readNdjson(stream(chunks))) out.push(value)
  return out
}

describe('readNdjson', () => {
  it('joins a line split across chunks', async () => {
    expect(await collect(['{"a":1}\n{"b"', ':2}\n'])).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('reads several lines in one chunk and a last line with no newline', async () => {
    expect(await collect(['{"a":1}\n{"b":2}\n{"c":3}'])).toEqual([{ a: 1 }, { b: 2 }, { c: 3 }])
  })

  it('skips blank lines', async () => {
    expect(await collect(['{"a":1}\n\n', '{"b":2}\n'])).toEqual([{ a: 1 }, { b: 2 }])
  })

  it('throws on a malformed line', async () => {
    await expect(collect(['{"a":\n'])).rejects.toThrow(SyntaxError)
  })
})
