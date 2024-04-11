import { Observable } from 'rxjs';
import { RpcClient } from './client.js';

const $iter = '$Iter' as const;

export type ProxyType<T, deep = true> = T extends (...args: any[]) => infer R
  ? (...args: Parameters<T>) => ProxyType<R, false>
  : T extends Observable<unknown>
  ? T
  : T extends string
  ? Promise<string>
  : T extends ReadonlyArray<unknown>
  ? Promise<T>
  : T extends Iterable<infer X>
  ? AsyncIterable<X>
  : T extends Generator<infer X, infer X2, infer X3>
  ? AsyncGenerator<X, X2, X3>
  : T extends AsyncIterable<unknown>
  ? T
  : T extends AsyncGenerator<unknown, unknown, unknown>
  ? T
  : T extends PromiseLike<infer R>
  ? Promise<R>
  : T extends { [key: string]: any }
  ? deep extends true
    ? {
        [K in keyof T as T[K] extends (...args: infer _1) => unknown
          ? ReturnType<ProxyType<T[K]>> extends AsyncIterable<unknown>
            ? `${K & string}${typeof $iter}`
            : ReturnType<ProxyType<T[K]>> extends AsyncGenerator<unknown>
            ? `${K & string}${typeof $iter}`
            : ReturnType<ProxyType<T[K]>> extends Observable<unknown>
            ? `${K & string}$`
            : K
          : K]: ProxyType<T[K]>;
      }
    : Promise<T>
  : Promise<T>;

export function funcProxy<T extends (...args:unknown[])=> unknown>(client: RpcClient, address: string, returnType: 'promise' | 'gen' | 'observable' = 'promise') {
  return ((...args:unknown[])=>{
    if (returnType === 'promise') {
      return client.functionRef(address)(...args);
    } else if (returnType === 'observable') {
      return client.functionObservableRef(address)(...args);
    }
    return client.functionGenRef(address)(...args);
  }) as ProxyType<T, false>;
}


export function createProxy<T>(
  client: RpcClient,
  address: string,
  returnType: 'promise' | 'gen' | 'observable' = 'promise'
): ProxyType<T> {
  return new Proxy(function () {}, {
    apply(_, __, args) {
      return funcProxy(client, address, returnType)(...args);
    },
    get(_: any, prop: string) {
      if (prop === 'then') {
        const promise = client.fieldRef(address).get();
        return promise.then.bind(promise);
      }
      const [type, addressProp] = prop.endsWith($iter)
        ? ['gen' as const, prop.slice(0, -1 * $iter.length)]
        : prop.endsWith('$')
        ? ['observable' as const, prop.slice(0, -1)]
        : ['promise' as const, prop];
      const applyProxy = createProxy(client, `${address}/${addressProp}`, type);
      return applyProxy;
    },
  }) as unknown as ProxyType<T>;
}
