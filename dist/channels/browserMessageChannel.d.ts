import { TransportListener, TransportResponder } from '../index.js';
type Postable = MessagePort | Window;
export declare function createPostMessageClient(clientId: string, target: Postable, outgoingPort: MessagePort): {
    handler: (e: MessageEvent) => void;
    client: {
        functionRef<T extends (...args: any[]) => any>(address: string): (...args: Parameters<T>) => Promise<ReturnType<T>>;
        functionGenRef<T_1 extends (...args: any[]) => any>(address: string): (...args: Parameters<T_1>) => AsyncGenerator<Awaited<ReturnType<T_1> extends AsyncGenerator<infer U, any, unknown> ? U : never>, unknown, unknown>;
        functionObservableRef<T_2 extends (...args: any[]) => any>(address: string): (...args: Parameters<T_2>) => import("rxjs").Observable<ReturnType<T_2> extends import("rxjs").Observable<infer U_1> ? U_1 : never>;
        fieldRef<T_3>(address: string): {
            set(value: T_3): Promise<void>;
            get(): Promise<T_3>;
        };
    };
};
export declare function createPostMessageServer(port?: MessagePort): {
    getMessagePort(client: string): MessagePort | undefined;
    handler: (e: MessageEvent) => void;
    onCall: TransportListener;
    respond: TransportResponder;
};
export {};
//# sourceMappingURL=browserMessageChannel.d.ts.map