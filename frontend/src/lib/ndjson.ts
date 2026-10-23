// Newline-delimited JSON from a fetch body. A line can arrive split across chunks,
// and several lines can arrive in one; each value is yielded exactly once.

export async function* readNdjson(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffered = ''
  try {
    for (;;) {
      const { done, value } = await reader.read()
      buffered += done ? decoder.decode() : decoder.decode(value, { stream: true })
      let newline: number
      while ((newline = buffered.indexOf('\n')) !== -1) {
        const line = buffered.slice(0, newline).trim()
        buffered = buffered.slice(newline + 1)
        if (line) yield JSON.parse(line)
      }
      if (done) break
    }
    if (buffered.trim()) yield JSON.parse(buffered)
  } finally {
    reader.releaseLock()
  }
}
