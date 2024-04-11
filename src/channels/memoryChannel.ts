import EventEmitter from 'events';
import { RemoteCallObject, RemoteResult, TransportInvoker, TransportListener, TransportResponder } from '../core/index.js';

export function createMemoryChannel(input: EventEmitter, output: EventEmitter) {
  const onCall: TransportListener = (fn) => {
    const handler = (data: string) => {
      fn(JSON.parse(data) as RemoteCallObject);
    }
    input.on('request',handler);

    return ()=> input.off('request', handler)
  };

  const respond: TransportResponder = async (result) => {
    output.emit('response_' + result.correlationId, JSON.stringify(result));
  };

  const send: TransportInvoker = async (call, cb) => {
    const eventId = 'response_' + call.correlationId;
    if (input.listenerCount(eventId) > 0) {
      input.removeAllListeners(eventId);
    }
    input.on(eventId, function f(result: string) {
      const res = JSON.parse(result) as RemoteResult;
      if (res.type === 'error' || res.done) {
        input.off(eventId, f);
      }
      cb(res);
    });

    output.emit('request', JSON.stringify(call));
  };

  return {
    onCall,
    respond,
    send,
  };
}
