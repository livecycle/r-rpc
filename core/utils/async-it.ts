/*
Convert any kind of JS native sync/async (T, Promise<T>, Iterable<T>) primitive value to async iterable
*/
export function convertToAsyncIterable<T>(
  result: AsyncIterable<T> | Iterable<T> | T | PromiseLike<T>
): AsyncIterator<T, T, undefined> {
  if (typeof result === 'object' && !Array.isArray(result) && result && Symbol.iterator in result) {
    const iterable = result as Iterable<T>;
    const iter = iterable[Symbol.iterator]();
    return {
      async next(...args: [] | [undefined]) {
        return iter.next(...args);
      },
      async throw(e: any) {
        return iter.throw!(e);
      },
      async return(...args) {
        return iter.return!(...args);
      },
    };
  } else if (typeof result === 'object' && result && Symbol.asyncIterator in result) {
    const iterable = result as AsyncIterable<T>;
    return iterable[Symbol.asyncIterator]();
  }

  const s = (async function* () {
    yield result as T;
  })() as AsyncIterable<T>;

  return s[Symbol.asyncIterator]();
}
