import {
  createClient,
  createRouter,
  RemoteCall,
  RemoteResult,
  TransportInvoker,
  TransportListener,
  TransportResponder,
} from '../index.js';

type Postable = MessagePort | Window;

export function createPostMessageClient(clientId: string, target: Postable, outgoingPort: MessagePort) {
  const corMap = new Map<string, (r: RemoteResult) => void>();
  let sentOngoingPort = false;
  const invoker: TransportInvoker = async (call, cb) => {
    corMap.set(call.correlationId, cb);
    if (target instanceof MessagePort) {
      target.postMessage({ clientId, remoteCall: call });
    } else {
      if (!sentOngoingPort) {
        target.postMessage({ clientId, remoteCall: call }, '*', [outgoingPort]);
        sentOngoingPort = true;
      } else {
        target.postMessage({ clientId, remoteCall: call }, '*');
      }
    }
  };
  return {
    handler: (e: MessageEvent) => {
      if (e.data.remoteResult) {
        const call = e.data.remoteResult as RemoteResult;
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

export function createPostMessageServer(port?: MessagePort) {
  const corMap = new Map<string, MessageEvent>();
  const clientPorts = new Map<string, MessagePort>();
  let sink: (call: RemoteCall) => void = async () => {
    console.warn('should never be called');
  };
  const onCall: TransportListener = (fn) => {
    sink = fn;
  };
  const respond: TransportResponder = async (result) => {
    const event = corMap.get(result.correlationId);
    if (!event) {
      throw 'error getting event for correleationId';
    }
    if (!clientPorts.has(event.data.clientId)) {
      return;
    }
    try {
      const clientPort: MessagePort = clientPorts.get(event.data.clientId)!;

      clientPort.postMessage({
        remoteResult: result,
      });
    } finally {
      if (result.type === 'error' || result.done) {
        corMap.delete(result.correlationId);
      }
    }
  };
  return {
    getMessagePort(client: string) {
      return clientPorts.get(client);
    },
    handler: (e: MessageEvent) => {
      if (e.data.remoteCall) {
        const targetPort = port ?? e.ports[0];
        if (clientPorts.get(e.data.clientId) !== targetPort && targetPort) {
          clientPorts.set(e.data.clientId, targetPort);
        }
        const call = e.data.remoteCall as RemoteCall;
        corMap.set(call.correlationId, e);
        sink(e.data.remoteCall);
      }
    },
    onCall,
    respond,
  };
}
