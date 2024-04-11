import { Observable } from 'rxjs';
import { RpcClient } from './client.js';

const $iter = '$Iter' as const;

type asyncifyDeep<T> = T extends (...args: infer _1) => infer _2
  ? (...args: _1) => ProxyType<_2>
  : T extends ReadonlyArray<infer X>
  ? ReadonlyArray<asyncifyDeep<X>>
  : T extends Iterable<infer X>
  ? Iterable<asyncifyDeep<X>>
  : T extends Generator<infer X, infer X2, infer X3>
  ? Generator<asyncifyDeep<X>, asyncifyDeep<X2>, asyncifyDeep<X3>>
  : T extends AsyncIterable<infer X>
  ? AsyncIterable<asyncifyDeep<X>>
  : T extends AsyncGenerator<infer X, infer X2, infer X3>
  ? AsyncGenerator<asyncifyDeep<X>, asyncifyDeep<X2>, asyncifyDeep<X3>>
  : T extends PromiseLike<infer R>
  ? Promise<asyncifyDeep<R>>
  : T extends {
    [key: string]: any;
  } ? {
    [K in keyof T]: asyncifyDeep<T[K]>;
  }: T;

export type ProxyType<T> = 
  T extends Observable<unknown>
  ? T
  : T extends string
  ? Promise<string>
  : T extends ReadonlyArray<unknown>
  ? Promise<asyncifyDeep<T>>
  : T extends Iterable<infer X>
  ? AsyncIterable<X>
  : T extends Generator<infer X, infer X2, infer X3>
  ? AsyncGenerator<X, X2, X3>
  : T extends AsyncIterable<unknown>
  ? asyncifyDeep<T>
  : T extends AsyncGenerator<unknown, unknown, unknown>
  ? asyncifyDeep<T>
  : T extends PromiseLike<infer R>
  ? asyncifyDeep<T>
  : T extends { [key: string]: any }
  ? Promise<asyncifyDeep<T>>
  : Promise<T>

  export type ProxyService<T extends { [key: string]: any }> = {
    [K in keyof T as T[K] extends (...args: infer _1) => infer _2
    ? ProxyType<_2> extends AsyncIterable<unknown>
      ? `${K & string}${typeof $iter}`
      : ProxyType<_2> extends AsyncGenerator<unknown>
      ? `${K & string}${typeof $iter}`
      : ProxyType<_2> extends Observable<unknown>
      ? `${K & string}$`
      : K
    : K]: asyncifyDeep<T[K]>;
  }

export function funcProxy<T extends (...args:unknown[])=> unknown>(client: RpcClient, address: string, returnType: 'promise' | 'gen' | 'observable' = 'promise') {
  return ((...args:unknown[])=>{
    if (returnType === 'promise') {
      return client.functionRef(address)(...args);
    } else if (returnType === 'observable') {
      return client.functionObservableRef(address)(...args);
    }
    return client.functionGenRef(address)(...args);
  }) as asyncifyDeep<T>;
}

export function createProxy<T extends {[key:string]: unknown}>(
  client: RpcClient,
  address: string,
  returnType: 'promise' | 'gen' | 'observable' = 'promise'
): ProxyService<T> {
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
  }) as unknown as ProxyService<T>;
}
