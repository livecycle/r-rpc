# r-rpc

[![GitHub license](https://img.shields.io/github/license/livecycle/r-rpc)](https://github.com/livecycle/r-rpc/blob/master/LICENSE)
[![Project Status: Active](https://img.shields.io/badge/Project%20Status-Active-green.svg)](https://github.com/livecycle/r-rpc)

**r-rpc** is a library for remote procedure calls (RPC) that enables communication between different parts of an application, potentially running in different environments (e.g., browser and server). It supports various communication paradigms, including async functions, generators, and observables.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Getting Started](#getting-started)
  - [Basic Setup](#basic-setup)
  - [High-Level API (Proxies)](#high-level-api---proxies-and-services)
  - [Low-Level API](#low-level-api---direct-function-calls)
- [Architecture](#architecture)
- [Transport Examples](#transport-examples)
- [Remote Function References](#remote-function-references-experimental)
- [Project Status](#project-status)
- [License](#license)

## Features

* **Function Calls:** Invoke remote functions with arguments and receive their return values.
* **Generators:** Execute remote generators (sync/async) and iterate over the yielded values (no support for sending data bi-directionally with next()). 
* **Observables:** Subscribe to remote observables and react to emitted values and events.
* **Remote Function References (Experimental):** Return functions from remote calls and execute them on the server.
* **Error Propagation and handling:** Errors are propagated back to the caller and can be caught and handled.
* **Cancellation Propagation:** Cancellations signals are sent both in generators and observables.
* **Flexible Transport:** r-rpc can be adapted to different communication channels by implementing the transport interfaces.
* **Type Safety:** Advanced TypeScript types and proxies are used to ensure end to end type safety for great developer experience.
* **Layered API:** Provides both high-level and low-level APIs for flexibility and control.

## Installation

```bash
npm install r-rpc
```

## Getting Started

### Basic Setup

1. **Server (Router) Setup:**
```typescript
import { createRouter } from 'r-rpc';

// Create and configure router
const router = createRouter(); 
router.bind(/* transport listener */, /* transport responder */); // Start listening for requests
```

2. **Client Setup:**
```typescript
import { createClient } from 'r-rpc';

// Create and configure client
const client = createClient(/* transport invoker */);
```

### High-Level API - Proxies and Services

The high-level API provides a more intuitive way to interact with remote services using TypeScript proxies.

**Server-side Service Registration:**
```typescript
import { registerService } from 'r-rpc';
import { Observable } from 'rxjs';

const service = {
  // Regular function
  sum(a: number, b: number) {
    return a + b;
  },
  
  // Generator function
  *numbers(max: number) {
    let i = 0;
    while(i < max) {
      yield i++;
    }
  },
  
  // Async function
  async delayedSum(a: number, b: number) {
    await new Promise((r) => setTimeout(r, 100));
    return a + b;
  },
  
  // Observable
  events(initialValue: number) {
    return new Observable((observer) => {
      let i = initialValue;
      const interval = setInterval(() => {
        observer.next(i++);
      }, 100);
      return () => clearInterval(interval);
    });
  }
};

registerService(router, 'myService', service);
```

**Client-side Service Usage:**
```typescript
import { createProxy } from 'r-rpc';

// Create typed proxy for the service
const myServiceProxy = createProxy<typeof service>(client, 'myService');

// Regular function call
const sum = await myServiceProxy.sum(5, 10);

// Generator iteration
for await (const num of myServiceProxy.numbers$Iter(10)) {
  console.log(num); // 0, 1, 2, ...
}

// Observable subscription
const subscription = myServiceProxy.events$(10).subscribe(value => {
  console.log(value); // 10, 11, 12, ...
});
subscription.unsubscribe();

// Async function call
const delayedSum = await myServiceProxy.delayedSum(20, 30);
```

### Low-Level API - Direct Function Calls

The low-level API provides more control over the RPC calls:

```typescript
// Client-side:
type SumFunction = (a: number, b: number) => number;
const sumResult = await client.functionRef<SumFunction>('some-service/sum')(5, 10);

// Server-side:
router.addRoute('some-service/sum', (a, b) => a + b);
```

## Architecture 

r-rpc separates the concerns of transport, routing, and service definition:

* **Transport:** Implementations for sending and receiving messages over specific communication channels. 
* **Router (Server):** Maps incoming requests to registered functions or services.
* **Client:** Provides methods for invoking remote functions, generators, and observables. 
* **Proxy (Client):** High-level abstraction for interacting with services as if they were local objects.

## Transport Examples

### 1. In-Memory Channel

Useful for testing or when both client and server are in the same process:

```typescript
import { createRouter, createClient, createMemoryChannel } from 'r-rpc';
import { EventEmitter } from 'events';

const e1 = new EventEmitter();
const e2 = new EventEmitter();

// Server setup
const { onCall, respond } = createMemoryChannel(e1, e2);
const router = createRouter();
router.bind(onCall, respond);

// Client setup
const { send } = createMemoryChannel(e2, e1);
const client = createClient(send);
```

### 2. Browser Message Channel

For communication between browser windows/iframes:

**Server (Parent Window):**
```typescript
import { createPostMessageServer } from 'r-rpc';

const { router, handler, onCall, respond } = createPostMessageServer();
router.bind(onCall, respond);
window.addEventListener('message', handler); 
```

**Client (Child Window):**
```typescript
import { createPostMessageClient } from 'r-rpc';

const channel = new MessageChannel();
const { client, handler } = createPostMessageClient(
  'myClient', 
  window.parent, 
  channel.port1
);

window.addEventListener('message', handler);
channel.port2.start();
```

### Creating Custom Transport

To implement a custom transport channel, provide these components:

```typescript
// Types for transport implementations
type TransportListener = (onCall: (call: RemoteCallObject) => void) => void;
type TransportResponder = (call: RemoteResult) => Promise<void>;
type TransportInvoker = (
  call: RemoteCallObject, 
  callback: (r: RemoteResult) => void
) => Promise<void>; 
```

Example WebSocket transport implementation:
```typescript
import { WebSocketServer } from 'ws';
import { createRouter } from 'r-rpc';

// Server-side
const wss = new WebSocketServer({ port: 8080 });

function createWebSocketListener(ws: WebSocket): TransportListener {
  return (onCall) => {
    ws.on('message', (message) => {
      const call = JSON.parse(message.toString()) as RemoteCallObject;
      onCall(call);
    });
  };
}

function createWebSocketResponder(ws: WebSocket): TransportResponder {
  return async (result) => {
    ws.send(JSON.stringify(result));
  };
}

wss.on('connection', (ws) => {
  const router = createRouter();
  router.bind(
    createWebSocketListener(ws),
    createWebSocketResponder(ws)
  );
});

// Client-side
function createWebSocketInvoker(ws: WebSocket): TransportInvoker {
  const correlationMap = new Map<string, (r: RemoteResult) => void>();

  ws.on('message', (message) => {
    const result = JSON.parse(message.toString()) as RemoteResult;
    const callback = correlationMap.get(result.correlationId);
    callback?.(result);
    if (result.type === 'error' || result.done) {
      correlationMap.delete(result.correlationId);
    }
  });

  return (call, callback) => {
    return new Promise((resolve, reject) => {
      correlationMap.set(call.correlationId, callback);
      ws.send(JSON.stringify(call));
      ws.on('error', reject);
    });
  };
}

const ws = new WebSocket('ws://localhost:8080');
const client = createClient(createWebSocketInvoker(ws));
```

## Remote Function References (Experimental)

r-rpc supports returning function references from remote procedure calls, enabling more complex interactions between client and server.

### Overview

- Functions can be returned directly or nested within objects/arrays
- Functions can return other functions (chaining)
- Server-side closures are maintained
- Cleanup is handled through garbage collection or manual release

### Usage

1. **Enable the Feature:**
```typescript
// Server
import { routerFunctionRefMiddleware, createRouter } from 'r-rpc';
const router = routerFunctionRefMiddleware(createRouter());

// Client
import { clientFunctionRefMiddleware, createClient } from 'r-rpc';
const client = clientFunctionRefMiddleware(createClient(transportInvoker));
```

2. **Example Usage:**
```typescript
// Server-side
const counterService = {
  createCounter: (start: number) => {
    let count = start;
    return {
      inc: () => ++count,
      dec: () => --count,
      current: () => count
    };
  }
};

registerService(router, "counter-service", counterService);

// Client-side
const remoteService = createProxy<typeof counterService>(client, "counter-service");
const counter = await remoteService.createCounter(0);

await counter.inc();  // 1
await counter.inc();  // 2
await counter.dec();  // 1
console.log(await counter.current()); // 1

// Optional: Manual cleanup
import { release } from 'r-rpc';
release(counter);
```

### Limitations

- Closures persist until garbage collection or manual release
- No support for returning iterators/observables as function references
- Function references must be properly cleaned up to avoid memory leaks

## Project Status

While r-rpc is used in production applications, it is still under active development and may undergo changes. Feedback and contributions are welcome!

## License

[MIT](LICENSE)
