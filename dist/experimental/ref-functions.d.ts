import { Observable } from "rxjs";
import { RpcClient } from "../core/client.js";
import { TransportListener, TransportResponder } from "../core/contracts.js";
import { RpcRouter } from "../core/router.js";
export declare function withValueReviver(client: RpcClient, revive: <T>(x: T) => T): RpcClient;
export declare const clientRefFunctionMiddleware: (client: RpcClient) => {
    functionRef<T extends (...args: any[]) => any>(address: string): (...args: Parameters<T>) => Promise<ReturnType<T>>;
    functionGenRef<T_1 extends (...args: any[]) => any>(address: string): (...args: Parameters<T_1>) => AsyncGenerator<Awaited<ReturnType<T_1> extends AsyncGenerator<infer U, any, unknown> ? U : never>, unknown, unknown>;
    functionObservableRef<T_2 extends (...args: any[]) => any>(address: string): (...args: Parameters<T_2>) => Observable<ReturnType<T_2> extends Observable<infer U_1> ? U_1 : never>;
    fieldRef<T_3>(address: string): {
        set(value: T_3): Promise<void>;
        get(): Promise<T_3>;
    };
};
export declare const serverRefFunctionMiddleware: (router: RpcRouter) => {
    bind(listener: TransportListener, responder: TransportResponder): void;
    addPrefixRoute: <TArgs extends unknown[], TReturn>(address: string, fnByPrefix: (prefix: string) => (...args: TArgs) => TReturn | AsyncIterable<TReturn> | Iterable<TReturn> | PromiseLike<TReturn>) => void;
    removeRoute: (address: string) => void;
    addRoute: <TArgs_1 extends unknown[], TReturn_1>(address: string, fn: (...args: TArgs_1) => TReturn_1 | AsyncIterable<TReturn_1> | Iterable<TReturn_1> | PromiseLike<TReturn_1>) => void;
};
//# sourceMappingURL=ref-functions.d.ts.map