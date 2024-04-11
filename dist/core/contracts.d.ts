export type RemoteCallObject = RemoteCall | RemoteCallCancel;
export type RemoteCall = {
    address: string;
    args: any[];
    correlationId: string;
    type: 'call';
};
export type RemoteCallCancel = {
    address: string;
    correlationId: string;
    type: 'cancel';
};
type RemoteResultValue<T, TErr extends Error> = {
    type: 'next';
    value: T;
    done: boolean;
} | {
    type: 'error';
    error: TErr;
};
export type RemoteResult<T = unknown, TErr extends Error = Error> = RemoteResultValue<T, TErr> & {
    correlationId: string;
};
export type TransportResponder = (call: RemoteResult) => Promise<void>;
export type TransportInvoker = (call: RemoteCallObject, callback: (r: RemoteResult) => void) => Promise<void>;
export type TransportListener = (onCall: (call: RemoteCallObject) => void) => void;
export declare const FunctionRef$ = "__FunctionRef$";
export declare const FunctionRefType$ = "__FunctionRefType$";
export type FunctionRefType$ = "observable" | "gen" | "promise";
export type FunctionRef$<T> = T extends (...args: unknown[]) => unknown ? T & {
    [FunctionRef$]: string;
    [FunctionRefType$]: FunctionRefType$;
} : never;
export declare const routerTrieSymbol: unique symbol;
export {};
//# sourceMappingURL=contracts.d.ts.map