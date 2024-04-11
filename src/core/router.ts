import { from, isObservable, Observable, of } from 'rxjs';
import { RemoteCall, RemoteCallObject, RemoteResult, TransportListener, TransportResponder } from './contracts.js';
import { convertToAsyncIterable } from './utils/async-it.js';
import Trie from './utils/trie.js';

function isPromiseLike<T>(value: PromiseLike<T> | T): value is PromiseLike<T> {
  return value && typeof (value as any).then === 'function';
}

function convertToObservable<T>(value: PromiseLike<T> | T | Observable<T>): Observable<T> {
  if (isObservable(value)) {
    return value;
  } else if (isPromiseLike(value)) {
    return from(value);
  } else {
    return of(value);
  }
}

export function createRouter(listener: TransportListener, responder: TransportResponder) {
  const routeTree = new Trie<(call: RemoteCall, cb: (r: RemoteResult) => void) => void>();
  const executors = new Map<
    string,
    {
      next: () => Promise<void>;
      cancel: () => void;
    }
  >();
  function createHandler<TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => AsyncIterable<TReturn> | Iterable<TReturn> | TReturn | PromiseLike<TReturn>
  ) {
    return function (call: RemoteCall, cb: (r: RemoteResult) => void) {
      let executor = executors.get(call.correlationId);
      if (!executor) {
        let result: ReturnType<typeof fn>;
        try {
          result = fn(...(call.args as TArgs));
        } catch (err) {
          cb({
            correlationId: call.correlationId,
            type: 'error',
            error: err as Error,
          });
          return;
        }

        if (
          typeof result === 'object' &&
          result &&
          (Symbol.asyncIterator in result || Symbol.iterator in result) &&
          !Array.isArray(result)
        ) {
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
        } else {
          const obs = convertToObservable(result as PromiseLike<TReturn> | TReturn | Observable<TReturn>);
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
            next: async () => {},
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
          error: err as Error,
        });
      });
    };
  }

  return {
    addPrefixRoute<TArgs extends unknown[], TReturn>(
      address: string,
      fnByPrefix: (
        prefix: string
      ) => (...args: TArgs) => AsyncIterable<TReturn> | Iterable<TReturn> | TReturn | PromiseLike<TReturn>
    ) {
      routeTree.set(
        address,
        (call, cb) => {
          const fn = fnByPrefix(call.address);
          return createHandler(fn)(call, cb);
        },
        true
      );
    },
    addRoute<TArgs extends unknown[], TReturn>(
      address: string,
      fn: (...args: TArgs) => AsyncIterable<TReturn> | Iterable<TReturn> | TReturn | PromiseLike<TReturn>
    ) {
      routeTree.set(address, createHandler(fn));
    },
    bind() {
      return listener(async (call: RemoteCallObject) => {
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
          return responder(r).catch((error) =>
            responder({
              type: 'error',
              error: new Error(`failed to send error response`),
              correlationId: call.correlationId,
            }).catch(() => {
              return;
            })
          );
        });
      });
    },
  };
}

export function registerService<TService>(router: RpcRouter, address: string, service: TService) {
  router.addPrefixRoute(address, (callAddress) => {
    const fragments = callAddress.substr(address.length + 1).split('/');
    let ref: any = service;
    let parent: any = service;
    let prop = '';
    for (const f of fragments) {
      parent = ref;
      prop = f;
      ref = parent[f];
    }
    if (typeof ref === 'function') {
      return (...args: any[]) => ref(...args);
    } else {
      const property = Object.getOwnPropertyDescriptor(parent, prop);
      if (property) {
        return (...args: any[]) => {
          if (args.length === 0) {
            return parent[prop];
          } else {
            parent[prop] = args[0];
          }
        };
      }
    }
    throw 'method not found';
  });
}

export type RpcRouter = ReturnType<typeof createRouter>;
