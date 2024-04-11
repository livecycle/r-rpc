import { Observable } from "rxjs";
import { FunctionRef$, FunctionRefType$ } from "../core/contracts.js";
import { funcProxy } from "../core/proxy.js";
import { IDGen } from "../core/utils/id.js";
const isRefFunction = (x) => {
    return typeof x === 'object' && !!x && FunctionRef$ in x && FunctionRefType$ in x;
};
const reviveFunction = (c) => {
    const registry = new FinalizationRegistry((heldValue) => {
        c.functionRef('/fn-unregister')(heldValue);
    });
    return (x) => {
        if (isRefFunction(x)) {
            registry.register(x, x[FunctionRef$]);
            return funcProxy(withValueReviver(c, reviveFunction(c)), `/fns/${x[FunctionRef$]}`, x[FunctionRefType$]);
        }
        if (Array.isArray(x)) {
            return x.map(reviveFunction(c));
        }
        if (typeof x === 'object' && !!x) {
            return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, reviveFunction(c)(v)]));
        }
        return x;
    };
};
export function withValueReviver(client, revive) {
    return {
        ...client,
        functionRef(address) {
            return async (...args) => {
                return revive(await client.functionRef(address)(...args));
            };
        },
        functionGenRef(address) {
            return async function* (...args) {
                for await (const x of client.functionGenRef(address)(...args)) {
                    yield revive(x);
                }
            };
        },
        functionObservableRef(address) {
            return (...args) => {
                return client.functionObservableRef(address)(...args).pipe(o => new Observable(obs => {
                    o.subscribe({
                        next(v) {
                            obs.next(revive(v));
                        },
                        error(err) {
                            obs.error(err);
                        },
                        complete() {
                            obs.complete();
                        }
                    });
                }));
            };
        },
    };
}
export const clientRefFunctionMiddleware = (client) => {
    return withValueReviver(client, reviveFunction(client));
};
export const serverRefFunctionMiddleware = (router) => {
    const encode = (x) => {
        if (typeof x === 'function') {
            const fnRef = IDGen();
            router.addRoute(`/fns/${fnRef}`, x);
            return {
                __FunctionRef$: fnRef,
                __FunctionRefType$: 'promise',
            };
        }
        if (Array.isArray(x)) {
            // @ts-ignore
            return x.map(encode);
        }
        if (typeof x === 'object' && !!x) {
            // @ts-ignore
            return Object.fromEntries(Object.entries(x).map(([k, v]) => [k, encode(v)]));
        }
        return x;
    };
    router.addRoute('/fn-unregister', (fnRef) => {
        router.removeRoute(`/fns/${fnRef}`);
    });
    return {
        ...router,
        bind(listener, responder) {
            return router.bind(listener, (result) => {
                if (result.type === 'next') {
                    return responder({
                        ...result,
                        value: encode(result.value)
                    });
                }
                return responder(result);
            });
        }
    };
};
