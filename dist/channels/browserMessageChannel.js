import { createClient, createRouter, } from '../index.js';
export function createPostMessageClient(clientId, target, outgoingPort) {
    const corMap = new Map();
    let sentOngoingPort = false;
    const invoker = async (call, cb) => {
        corMap.set(call.correlationId, cb);
        if (target instanceof MessagePort) {
            target.postMessage({ clientId, remoteCall: call });
        }
        else {
            if (!sentOngoingPort) {
                target.postMessage({ clientId, remoteCall: call }, '*', [outgoingPort]);
                sentOngoingPort = true;
            }
            else {
                target.postMessage({ clientId, remoteCall: call }, '*');
            }
        }
    };
    return {
        handler: (e) => {
            if (e.data.remoteResult) {
                const call = e.data.remoteResult;
                const p = corMap.get(call.correlationId);
                p?.(call);
                if (call.type === 'error' || call.done) {
                    corMap.delete(call.correlationId);
                }
            }
        },
        client: createClient(invoker),
    };
}
export function createPostMessageServer(port) {
    const corMap = new Map();
    const clientPorts = new Map();
    let sink = async () => {
        console.warn('should never be called');
    };
    const onCall = (fn) => {
        sink = fn;
    };
    const respond = async (result) => {
        const event = corMap.get(result.correlationId);
        if (!event) {
            throw 'error getting event for correleationId';
        }
        if (!clientPorts.has(event.data.clientId)) {
            return;
        }
        try {
            const clientPort = clientPorts.get(event.data.clientId);
            clientPort.postMessage({
                remoteResult: result,
            });
        }
        finally {
            if (result.type === 'error' || result.done) {
                corMap.delete(result.correlationId);
            }
        }
    };
    return {
        getMessagePort(client) {
            return clientPorts.get(client);
        },
        handler: (e) => {
            if (e.data.remoteCall) {
                const targetPort = port ?? e.ports[0];
                if (clientPorts.get(e.data.clientId) !== targetPort && targetPort) {
                    clientPorts.set(e.data.clientId, targetPort);
                }
                const call = e.data.remoteCall;
                corMap.set(call.correlationId, e);
                sink(e.data.remoteCall);
            }
        },
        router: createRouter(onCall, respond),
    };
}
