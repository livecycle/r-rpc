import { lastValueFrom, Observable } from 'rxjs';
const ID = function () {
    return Math.random().toString(36).substring(2, 9);
};
export function createClient(invoker, idGen = ID) {
    async function* exec(call) {
        let isFinished = false;
        try {
            while (true) {
                const result = await new Promise((res, rej) => invoker(call, (v) => res(v)).catch(rej));
                if (result.type === 'next') {
                    if (result.done) {
                        isFinished = true;
                        return result.value;
                    }
                    yield result.value;
                }
                else if (result.type === 'error') {
                    throw result.error;
                }
            }
        }
        finally {
            if (!isFinished) {
                await invoker({
                    correlationId: call.correlationId,
                    address: call.address,
                    type: 'cancel',
                }, () => { });
            }
        }
    }
    function execObservable(callGen) {
        return new Observable((obs) => {
            const call = callGen();
            invoker(call, (result) => {
                if (result.type === 'next') {
                    if (result.done) {
                        obs.complete();
                    }
                    else {
                        obs.next(result.value);
                    }
                }
                else if (result.type === 'error') {
                    obs.error(result.error);
                }
            }).catch((err) => {
                obs.error(err);
            });
            return () => {
                invoker({
                    correlationId: call.correlationId,
                    address: call.address,
                    type: 'cancel',
                }, () => { }).catch((err) => {
                    console.error('failed to send cancel signal', err);
                });
            };
        });
    }
    return {
        functionRef(address) {
            return (...args) => {
                const observable = execObservable(() => ({
                    correlationId: idGen(),
                    address,
                    args,
                    type: 'call',
                }));
                return lastValueFrom(observable);
            };
        },
        functionGenRef(address) {
            return (...args) => {
                const iter = exec({
                    correlationId: idGen(),
                    address,
                    args,
                    type: 'call',
                });
                return iter;
            };
        },
        functionObservableRef(address) {
            return (...args) => {
                const observable = execObservable(() => ({
                    correlationId: idGen(),
                    address,
                    args,
                    type: 'call',
                }));
                return observable;
            };
        },
        fieldRef(address) {
            return {
                set(value) {
                    return lastValueFrom(execObservable(() => ({
                        correlationId: idGen(),
                        address,
                        args: [value],
                        type: 'call',
                    })));
                },
                async get() {
                    return lastValueFrom(execObservable(() => ({
                        correlationId: idGen(),
                        address,
                        args: [],
                        type: 'call',
                    })));
                },
            };
        },
    };
}
