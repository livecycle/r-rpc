import { lastValueFrom, Observable } from 'rxjs';
import type { RemoteCall, RemoteResult, TransportInvoker } from './contracts.js';
import { IDGen } from './utils/id.js';

export function createClient(invoker: TransportInvoker, idGen: () => string = IDGen) {
  async function* exec<T>(call: RemoteCall) {
    let isFinished = false;
    try {
      while (true) {
        const result = await new Promise<RemoteResult>((res, rej) => invoker(call, (v) => res(v)).catch(rej));
        if (result.type === 'next') {
          if (result.done) {
            isFinished = true;
            return result.value;
          }
          yield result.value as T;
        } else if (result.type === 'error') {
          throw result.error;
        }
      }
    } finally {
      if (!isFinished) {
        await invoker(
          {
            correlationId: call.correlationId,
            address: call.address,
            type: 'cancel',
          },
          () => {}
        );
      }
    }
  }

  function execObservable<T>(callGen: () => RemoteCall): Observable<T> {
    return new Observable<T>((obs) => {
      const call = callGen();
      invoker(call, (result) => {
        if (result.type === 'next') {
          if (result.done) {
            obs.complete();
          } else {
            obs.next(result.value as T);
          }
        } else if (result.type === 'error') {
          obs.error(result.error);
        }
      }).catch((err) => {
        obs.error(err);
      });

      return () => {
        invoker(
          {
            correlationId: call.correlationId,
            address: call.address,
            type: 'cancel',
          },
          () => {}
        ).catch((err) => {
          console.error('failed to send cancel signal', err);
        });
      };
    });
  }

  return {
    functionRef<T extends (...args: any[]) => any>(address: string) {
      return (...args: Parameters<T>) => {
        type returnType = ReturnType<T>;
        const observable = execObservable<returnType>(() => ({
          correlationId: idGen(),
          address,
          args,
          type: 'call',
        }));
        return lastValueFrom(observable);
      };
    },
    functionGenRef<T extends (...args: any[]) => any>(address: string) {
      return (...args: Parameters<T>) => {
        type returnType = ReturnType<T> extends AsyncGenerator<infer U> ? U : never;
        const iter = exec<returnType>({
          correlationId: idGen(),
          address,
          args,
          type: 'call',
        });
        return iter;
      };
    },
    functionObservableRef<T extends (...args: any[]) => any>(address: string) {
      return (...args: Parameters<T>) => {
        type returnType = ReturnType<T> extends Observable<infer U> ? U : never;
        const observable = execObservable<returnType>(() => ({
          correlationId: idGen(),
          address,
          args,
          type: 'call',
        }));
        return observable;
      };
    },
    fieldRef<T>(address: string) {
      return {
        set(value: T) {
          return lastValueFrom(
            execObservable<void>(() => ({
              correlationId: idGen(),
              address,
              args: [value],
              type: 'call',
            }))
          );
        },
        async get() {
          return lastValueFrom(
            execObservable<T>(() => ({
              correlationId: idGen(),
              address,
              args: [],
              type: 'call',
            }))
          );
        },
      };
    },
  };
}

export type RpcClient = ReturnType<typeof createClient>;
