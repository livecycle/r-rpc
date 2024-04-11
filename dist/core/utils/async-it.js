/*
Convert any kind of JS native sync/async (T, Promise<T>, Iterable<T>) primitive value to async iterable
*/
export function convertToAsyncIterable(result) {
    if (typeof result === 'object' && !Array.isArray(result) && result && Symbol.iterator in result) {
        const iterable = result;
        const iter = iterable[Symbol.iterator]();
        return {
            async next(...args) {
                return iter.next(...args);
            },
            async throw(e) {
                return iter.throw(e);
            },
            async return(...args) {
                return iter.return(...args);
            },
        };
    }
    else if (typeof result === 'object' && result && Symbol.asyncIterator in result) {
        const iterable = result;
        return iterable[Symbol.asyncIterator]();
    }
    const s = (async function* () {
        yield result;
    })();
    return s[Symbol.asyncIterator]();
}
