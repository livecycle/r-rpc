# r-rpc

**r-rpc** is a library for remote procedure calls (RPC) that enables communication between different parts of an application, potentially running in different environments (e.g., browser and server). It supports various communication paradigms, including async functions, generators, and observables.

## Features

*   **Function Calls:** Invoke remote functions with arguments and receive their return values.
*   **Generators:** Execute remote generators (sync/async) and iterate over the yielded values (no support for sending data bi-directionally with next()). 
*   **Observables:** Subscribe to remote observables and react to emitted values and events.
*   **Remote Function References (Experimental):** Return functions from remote calls and execute them on the server.
*   **Error Propagation and handling:** Errors are propagated back to the caller and can be caught and handled.
*   **Cancellation Propagation:** Cancellations signals are sent both in generators and observables.
*   **Flexible Transport:**  r-rpc can be adapted to different communication channels by implementing the transport interfaces.
*   **Type Safety:**  Advanced TypeScript types and proxies are used to ensure end to end type safety with great developer experience.
*   **Layered API:**  Provides both high-level and low-level APIs for flexibility and control.

## Getting Started

**Installation:**

```bash
npm install https://github.com/livecycle/r-rpc
```

### Setup - Creating Router and Client

**Server (Router):**

```typescript
import { createRouter } from 'r-rpc';

// Replace with your actual transport listener and responder
const router = createRouter(); 
router.bind(/* transport listener */, /* transport responder */); // Start listening for requests
```

**Client:**

```typescript
import { createClient } from 'r-rpc';

// Replace with your actual transport invoker
const client = createClient(/* transport invoker */);
```

### High-Level API - Proxies and Services

**Server (Service Registration):**

**Example: Service with Multiple Methods and Return Types**

```typescript
import { registerService } from 'r-rpc';
import { Observable } from 'rxjs';

const service = {
  sum(a: number, b: number) {
    return a + b;
  },
  concat(a: string, b: string) {
    return a + b; 
  },
  *numbers(max) {
    let i = 0;
    while(i < max) {
      yield i++;
    }
  },
  async delayedSum(a: number, b: number) {
    await new Promise((r) => setTimeout(r, 100)); // Simulate delay
    return a + b;
  }, 
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

**Client (Proxy Usage):**

```typescript
import { createProxy } from 'r-rpc';

const myServiceProxy = createProxy<typeof service>(client, 'myService');

// Call functions and get results directly
const sumResult = await myServiceProxy.sum(5, 10); 
const concatResult = await myServiceProxy.concat('hello', 'world');

// Iterate over async iterable
for await (const num of myServiceProxy.numbers$Iter(10)) {
  console.log(num); // 0, 1, 2, ...
}

// Consume observable
const subscription = myServiceProxy.events$(10).subscribe(value => {
  console.log(value); // 10, 11, 12, ...
});

// Unsubscribe when done
subscription.unsubscribe(); 

// Call async function
const delayedSumResult = await myServiceProxy.delayedSum(20, 30);
```

### Low-Level API - Direct Function Calls

```typescript
// Client-side:
type sumFunction = (a: number, b: number) => number
const sumResult = await client.functionRef<sumFunction>('some-service/sum')(5, 10);

// Server-side:
router.addRoute('some-service/sum', (a, b) => { a + b});
```

## Architecture 

r-rpc separates the concerns of transport, routing, and service definition. 

*   **Transport:** You provide implementations for sending and receiving messages over a specific communication channel. 
*   **Router (Server):** The router maps incoming requests to registered functions or services.
*   **Client:** The client provides methods for invoking remote functions, generators, and observables. 
*   **Proxy (Client):** A high-level abstraction for interacting with services as if they were local objects.

## Transport Examples

### 1. In-Memory Channel (memoryChannel)

This transport is useful for testing or when both the client and server reside within the same process.

```typescript
import { createRouter, createClient } from 'r-rpc';
import { createMemoryChannel } from 'r-rpc'
import { EventEmitter } from 'events';

const { onCall, respond } = createMemoryChannel(e1, e2);

const router = createRouter();
router.bind(onCall, respond);
// ... register services

const e1 = new EventEmitter();
const e2 = new EventEmitter();
const { send } = createMemoryChannel(e2, e1);

const client = createClient(send);
// ... use the client
```

### 2. Browser Message Channel (browserMessageChannel)

This transport is designed for communication between different browser windows, tabs, or iframes using the `postMessage` API.

**Server (Parent Window):**

```typescript
import { createPostMessageServer } from 'r-rpc';

const { router, handler, onCall, respond  } = createPostMessageServer();
// ... register services
router.bind(onCall, respond);

window.addEventListener('message', handler); 
```

**Client (Child Window):**

```typescript
import { createPostMessageClient } from 'r-rpc';

const channel = new MessageChannel();
const { client, handler } = createPostMessageClient('myClient', window.parent, channel.port1);

window.addEventListener('message', handler);
channel.port2.start();
// ... use the client
```

### Implementing a Channel

To implement a custom channel, you need to provide three key components:

*   **Transport Listener:** This component listens for incoming RPC requests on the server-side and passes them to the r-rpc router.
*   **Transport Invoker:** This component is responsible for sending RPC requests from the client-side and receiving responses from the server. 
*   **Transport Responder:** This component sends responses back to the client from the server-side based on the results of the RPC calls.

These components should adhere to the `TransportListener`, `TransportInvoker`, and `TransportResponder` interfaces defined in the `r-rpc` library.

**Interfaces:**

```typescript
// TransportListener (Server-side)
type TransportListener = (onCall: (call: RemoteCallObject) => void) => void;

// TransportResponder (Server-side)
type TransportResponder = (call: RemoteResult) => Promise<void>;

// TransportInvoker (Client-side) 
type TransportInvoker = (call: RemoteCallObject, callback: (r: RemoteResult) => void) => Promise<void>; 
``` 

**Example: Implementing a WebSocket Channel**

```typescript
// Server-side (TransportListener)
import { WebSocketServer } from 'ws'; 

import { createRouter } from 'r-rpc';
import WebSocket from 'ws'; // Replace with your WebSocket library

const wss = new WebSocket.Server({ port: 8080 }); 

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
  const onCall = createWebSocketListener(ws);
  const respond = createWebSocketResponder(ws);
  const router = createRouter(); 
  // ... register services 
  router.bind(onCall, respond);
});

// Client-side (TransportInvoker)
import { createClient } from 'r-rpc';

const ws = new WebSocket('ws://localhost:8080');

function createWebSocketInvoker(ws: WebSocket): TransportInvoker {
  const corMap = new Map<string, (r: RemoteResult) => void>();

  // Register the message handler only once
  ws.on('message', (message) => { 
    const result = JSON.parse(message.toString()) as RemoteResult;
    const callback = corMap.get(result.correlationId);
    callback?.(result);
    if (result.type === 'error' || result.done) {
      corMap.delete(result.correlationId);
    }
  }); 

  return (call, callback) => {
    return new Promise((resolve, reject) => {
      corMap.set(call.correlationId, callback); 
      ws.send(JSON.stringify(call)); 
      ws.on('error', reject);  
    });
  };
}

const invoker = createWebSocketInvoker(ws);
const client = createClient(invoker);
// ... use the client
```

**By implementing custom channels, you can adapt r-rpc to any communication technology that suits your application's requirements.** 

## Remote Function References (Experimental)

r-rpc is experimenting with a new feature that allows you to return function references from remote procedure calls. This means that you can now pass functions as return values, enabling more complex and dynamic interactions between client and server. 

**Function references can be returned directly, as well as nested within objects or arrays. You can also have functions that return other functions, creating chains of remote function calls.**

**Here's how it works:**

1. **Server-Side (Encoding):** When a function is returned from a remote procedure on the server, r-rpc encodes it into a special reference object. This object contains a unique identifier for the function and information about its expected behavior (e.g., whether it returns a promise). 

2. **Client-Side (Decoding and Execution):** The client receives the reference object and uses it to create a local proxy function. This proxy function, when called, sends a request to the server to execute the actual remote function with the provided arguments. The result from the server is then returned to the client.

**Example:**

```typescript
// Server-side
router.addRoute('createCounter', () => {
  let count = 0;
  return () => ++count; // Returns a function
});

// Client-side
const counterFn = await client.functionRef('createCounter')(); // Get the remote function
const result1 = await counterFn(); // Call the remote function (returns 1)
const result2 = await counterFn(); // Call again (returns 2)
```
In this example, the `createCounter` function on the server returns a function that increments a counter. The client obtains a reference to this remote function and can call it multiple times, each time incrementing the counter on the server and receiving the updated value.

We can also use the high-level API with proxies to work with function references more easily:

```typescript
const counterGen = {
  createCounter: (start: number)=> {
      let count = start
      return {
          inc: () => ++count,
          dec: () => --count,
          current: () => count
      }
    }
};

registerService(router, "counter-gen", counterGen);
const remoteService = createProxy<typeof counterGen>(client, "counter-gen");
const counter1 = await remoteService.createCounter(0);
const counter2 = await remoteService.createCounter(0);

// All methods are correctly typed and converted to async signatures if needed
await counter1.inc();
await counter1.inc();
await counter1.dec();
await counter2.dec();
console.log(await counter1.current()); // 1
console.log(await counter2.current()); // -1;
```

**Benefits:**

*   **Dynamic Behavior:** You can create more dynamic and interactive applications by passing functions that encapsulate behavior or logic.
*   **Code Reusability:** Share and reuse functions between client and server, promoting modularity and reducing code duplication.
*   **State Management:**  Functions can maintain state on the server, allowing for stateful interactions without directly exposing the state itself. 

**Considerations and Limitations:**

*   **Closures:** Closures are currently kept alive on the server as long as the client holds a reference to the function. 
*   **Garbage Collection:** Unused function references on the client need to be garbage collected properly to avoid memory leaks and release server-side resources. r-rpc uses a `FinalizationRegistry` to track and clean up references when they are no longer used.
*   **No support for iterators/observables at this point:** The current implementation does not support returning a function that return iterators or observables as function references. This may change in future versions. 

**API and Middleware:**

*   **\`routerFunctionRefMiddleware\`:** Apply this middleware to your router on the server-side to enable encoding of returned functions.
*   **\`clientFunctionRefMiddleware\`:** Apply this middleware to your client on the client-side to enable decoding and execution of remote function references.

**Enablement:**

```typescript
// Server
const router = routerFunctionRefMiddleware(createRouter()); 
// ... add routes

// Client 
const client = clientFunctionRefMiddleware(createClient(transportInvoker)); 
// ... use the client
```

**This experimental feature opens up new possibilities for building more sophisticated and interactive RPC applications. As it evolves, expect improvements in type safety, serialization capabilities, and overall developer experience.**

## Early Stage Notice

While r-rpc is used in a real production application, it is still under development and may have limitations or undergo changes. Feedback and contributions are welcome!

## License

[MIT](LICENSE)