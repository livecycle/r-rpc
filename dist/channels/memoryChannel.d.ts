/// <reference types="node" />
import EventEmitter from 'events';
import { TransportInvoker, TransportListener, TransportResponder } from '../core';
export declare function createMemoryChannel(input: EventEmitter, output: EventEmitter): {
    onCall: TransportListener;
    respond: TransportResponder;
    send: TransportInvoker;
};
//# sourceMappingURL=memoryChannel.d.ts.map