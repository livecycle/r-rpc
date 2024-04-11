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

type RemoteResultValue<T, TErr extends Error> =
  | {
      type: 'next';
      value: T;
      done: boolean;
    }
  | {
      type: 'error';
      error: TErr;
    };

export type RemoteResult<T = unknown, TErr extends Error = Error> = RemoteResultValue<T, TErr> & {
  correlationId: string;
};
export type TransportResponder = (call: RemoteResult) => Promise<void>;
export type TransportInvoker = (call: RemoteCallObject, callback: (r: RemoteResult) => void) => Promise<void>;
export type TransportListener = (onCall: (call: RemoteCallObject) => void) => void;
