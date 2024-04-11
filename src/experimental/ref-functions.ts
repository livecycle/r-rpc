import { Observable } from "rxjs";
import { RpcClient } from "../core/client.js";
import { FunctionRef$, FunctionRefType$, TransportListener, TransportResponder } from "../core/contracts.js";
import { funcProxy } from "../core/proxy.js";
import { RpcRouter } from "../core/router.js";
import { IDGen } from "../core/utils/id.js";

const isRefFunction = <T>(x: unknown): x is FunctionRef$<T> => {
    return typeof x === 'object' && !!x && FunctionRef$ in x && FunctionRefType$ in x;
}

const reviveFunction = (c: RpcClient) => {
  const registry = new FinalizationRegistry((heldValue:string) => {
    c.functionRef<(s:string)=>void>('/fn-unregister')(heldValue);
  });
  return <T>(x: T): T => {
    if (isRefFunction(x)) {
        registry.register(x as any, x[FunctionRef$])
        return funcProxy(withValueReviver(c, reviveFunction(c)), `/fns/${x[FunctionRef$]}`, x[FunctionRefType$]) as T;
    }
    if (Array.isArray(x)) {
      return x.map(reviveFunction(c)) as T
    }
    if (typeof x === 'object' && !!x) {
        return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, reviveFunction(c)(v)])) as T
    }
    return x
}
}

export function withValueReviver(client: RpcClient, revive: <T>(x:T)=> T): RpcClient{
    return {
      ...client,
      functionRef<T extends (...args: any[]) => any>(address: string) {
        return async (...args: Parameters<T>) => {
          return revive(await client.functionRef<T>(address)(...args));
        };
      },
      functionGenRef<T extends (...args: any[]) => any>(address: string) {
        return async function*(...args: Parameters<T>){
          for await (const x of client.functionGenRef<T>(address)(...args)){
            yield revive(x);
          }
        };
      },
      functionObservableRef<T extends (...args: any[]) => any>(address: string) {
        return (...args: Parameters<T>) => {
          type returnType = ReturnType<T> extends Observable<infer U> ? U : never;
          return client.functionObservableRef<T>(address)(...args).pipe(o=> new Observable<returnType>(obs=>{
            o.subscribe({
              next(v){
                obs.next(revive(v));
              },
              error(err){
                obs.error(err);
              },
              complete(){
                obs.complete();
              }
            });
          }));
        };
      },
    }
  }

export const clientFunctionRefMiddleware = (client: RpcClient) => {
    return withValueReviver(client, reviveFunction(client));
}

export const routerFunctionRefMiddleware = (router: RpcRouter) => {
    const encode = <T>(x: T):T => {
        if (typeof x === 'function') {
            const fnRef = IDGen();
            router.addRoute(`/fns/${fnRef}`, x as (...args: unknown[]) => unknown);
            return {
                __FunctionRef$: fnRef,
                __FunctionRefType$: 'promise',
            } as FunctionRef$<T>
        }
        if (Array.isArray(x)) {
          // @ts-ignore
          return x.map(encode)
        }
        if (typeof x === 'object' && !!x) {
          // @ts-ignore
          return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, encode(v)])) as T
        }
       
        return x
    }
    router.addRoute('/fn-unregister', (fnRef: string) => {
        router.removeRoute(`/fns/${fnRef}`);
    })
    return {
        ...router,
        bind(listener: TransportListener, responder: TransportResponder){
            return router.bind(listener, (result)=> {
                if (result.type === 'next') {
                  return responder({
                    ...result,
                    value: encode(result.value)
                  })
                }
                return responder(result)
            })
        }
    }
}