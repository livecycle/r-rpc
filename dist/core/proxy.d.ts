import { Observable } from 'rxjs';
import { RpcClient } from './client.js';
declare const $iter: "$Iter";
export type ProxyType<T, deep = true> = T extends (...args: any[]) => infer R ? (...args: Parameters<T>) => ProxyType<R, false> : T extends Observable<unknown> ? T : T extends string ? Promise<string> : T extends ReadonlyArray<unknown> ? Promise<T> : T extends Iterable<infer X> ? AsyncIterable<X> : T extends Generator<infer X, infer X2, infer X3> ? AsyncGenerator<X, X2, X3> : T extends AsyncIterable<unknown> ? T : T extends AsyncGenerator<unknown, unknown, unknown> ? T : T extends PromiseLike<infer R> ? Promise<R> : T extends {
    [key: string]: any;
} ? deep extends true ? {
    [K in keyof T as T[K] extends (...args: infer _1) => unknown ? ReturnType<ProxyType<T[K]>> extends AsyncIterable<unknown> ? `${K & string}${typeof $iter}` : ReturnType<ProxyType<T[K]>> extends AsyncGenerator<unknown> ? `${K & string}${typeof $iter}` : ReturnType<ProxyType<T[K]>> extends Observable<unknown> ? `${K & string}$` : K : K]: ProxyType<T[K]>;
} : Promise<T> : Promise<T>;
export declare function createProxy<T>(client: RpcClient, address: string, returnType?: 'promise' | 'gen' | 'observable'): ProxyType<T>;
export {};
//# sourceMappingURL=proxy.d.ts.map