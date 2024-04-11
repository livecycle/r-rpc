import { TransportListener, TransportResponder } from './contracts.js';
export declare function createRouter(listener: TransportListener, responder: TransportResponder): {
    addPrefixRoute<TArgs extends unknown[], TReturn>(address: string, fnByPrefix: (prefix: string) => (...args: TArgs) => TReturn | AsyncIterable<TReturn> | Iterable<TReturn> | PromiseLike<TReturn>): void;
    addRoute<TArgs_1 extends unknown[], TReturn_1>(address: string, fn: (...args: TArgs_1) => TReturn_1 | AsyncIterable<TReturn_1> | Iterable<TReturn_1> | PromiseLike<TReturn_1>): void;
    bind(): void;
};
export declare function registerService<TService>(router: RpcRouter, address: string, service: TService): void;
export type RpcRouter = ReturnType<typeof createRouter>;
//# sourceMappingURL=router.d.ts.map