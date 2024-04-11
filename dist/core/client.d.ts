import { Observable } from 'rxjs';
import { TransportInvoker } from './contracts';
export declare function createClient(invoker: TransportInvoker, idGen?: () => string): {
    functionRef<T extends (...args: any[]) => any>(address: string): (...args: Parameters<T>) => Promise<ReturnType<T>>;
    functionGenRef<T_1 extends (...args: any[]) => any>(address: string): (...args: Parameters<T_1>) => AsyncGenerator<Awaited<ReturnType<T_1> extends AsyncGenerator<infer U, any, unknown> ? U : never>, unknown, unknown>;
    functionObservableRef<T_2 extends (...args: any[]) => any>(address: string): (...args: Parameters<T_2>) => Observable<ReturnType<T_2>>;
    fieldRef<T_3>(address: string): {
        set(value: T_3): Promise<void>;
        get(): Promise<T_3>;
    };
};
export type RpcClient = ReturnType<typeof createClient>;
//# sourceMappingURL=client.d.ts.map