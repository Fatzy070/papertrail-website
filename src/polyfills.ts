export function applyPolyfills() {
  if (
    typeof ReadableStream !== 'undefined' &&
    !ReadableStream.prototype[Symbol.asyncIterator]
  ) {
    // @ts-expect-error: TypeScript's DOM types expect a very specific ReadableStreamAsyncIterator return type, but a standard AsyncGenerator works perfectly at runtime.
    ReadableStream.prototype[Symbol.asyncIterator] = async function* () {
      const reader = this.getReader()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) return
          yield value
        }
      } finally {
        reader.releaseLock()
      }
    }
  }
}

// Automatically apply on import
applyPolyfills()
