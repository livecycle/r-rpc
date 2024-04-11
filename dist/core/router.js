import { from, isObservable, of } from 'rxjs';
import { convertToAsyncIterable } from './utils/async-it.js';
import Trie from './utils/trie.js';
function isPromiseLike(value) {
    return value && typeof value.then === 'function';
}
function convertToObservable(value) {
    if (isObservable(value)) {
        return value;
    }
    else if (isPromiseLike(value)) {
        return from(value);
    }
    else {
        return of(value);
    }
}
export function createRouter(listener, responder) {
    const routeTree = new Trie();
    const executors = new Map();
    function createHandler(fn) {
        return function (call, cb) {
            let executor = executors.get(call.correlationId);
            if (!executor) {
                let result;
                try {
                    result = fn(...call.args);
                }
                catch (err) {
                    cb({
                        correlationId: call.correlationId,
                        type: 'error',
                        error: err,
                    });
                    return;
                }
                if (typeof result === 'object' &&
                    result &&
                    (Symbol.asyncIterator in result || Symbol.iterator in result) &&
                    !Array.isArray(result)) {
                    const iter = convertToAsyncIterable(result);
                    executor = {
                        next: async () => {
                            const next = await iter.next();
                            cb({
                                correlationId: call.correlationId,
                                type: 'next',
                                value: next.value,
                                done: next.done ?? false,
                            });
                        },
                        cancel() {
                            iter.return?.();
                        },
                    };
                    executors.set(call.correlationId, executor);
                }
                else {
                    const obs = convertToObservable(result);
                    const sub = obs.subscribe({
                        next(v) {
                            cb({
                                correlationId: call.correlationId,
                                type: 'next',
                                value: v,
                                done: false,
                            });
                        },
                        error(err) {
                            cb({
                                correlationId: call.correlationId,
                                type: 'error',
                                error: err,
                            });
                        },
                        complete() {
                            cb({
                                correlationId: call.correlationId,
                                type: 'next',
                                value: undefined,
                                done: true,
                            });
                        },
                    });
                    executor = {
                        next: async () => { },
                        cancel() {
                            sub.unsubscribe();
                        },
                    };
                    executors.set(call.correlationId, executor);
                }
            }
            executor?.next().catch((err) => {
                cb({
                    correlationId: call.correlationId,
                    type: 'error',
                    error: err,
                });
            });
        };
    }
    return {
        addPrefixRoute(address, fnByPrefix) {
            routeTree.set(address, (call, cb) => {
                const fn = fnByPrefix(call.address);
                return createHandler(fn)(call, cb);
            }, true);
        },
        addRoute(address, fn) {
            routeTree.set(address, createHandler(fn));
        },
        bind() {
            return listener(async (call) => {
                if (call.type === 'cancel') {
                    const ex = executors.get(call.correlationId);
                    if (ex) {
                        ex.cancel();
                    }
                    responder({ type: 'next', done: true, value: undefined, correlationId: call.correlationId });
                    return;
                }
                const handler = routeTree.get(call.address);
                if (!handler) {
                    throw 'no handler for request';
                }
                handler(call, (r) => {
                    return responder(r).catch((error) => responder({
                        type: 'error',
                        error: new Error(`failed to send error response`),
                        correlationId: call.correlationId,
                    }).catch(() => {
                        return;
                    }));
                });
            });
        },
    };
}
export function registerService(router, address, service) {
    router.addPrefixRoute(address, (callAddress) => {
        const fragments = callAddress.substr(address.length + 1).split('/');
        let ref = service;
        let parent = service;
        let prop = '';
        for (const f of fragments) {
            parent = ref;
            prop = f;
            ref = parent[f];
        }
        if (typeof ref === 'function') {
            return (...args) => ref(...args);
        }
        else {
            const property = Object.getOwnPropertyDescriptor(parent, prop);
            if (property) {
                return (...args) => {
                    if (args.length === 0) {
                        return parent[prop];
                    }
                    else {
                        parent[prop] = args[0];
                    }
                };
            }
        }
        throw 'method not found';
    });
}
