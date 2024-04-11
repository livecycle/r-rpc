# r-rpc

**r-rpc** is a library for remote procedure calls (RPC) that enables communication between different parts of an application, potentially running in different environments (e.g., browser and server). It supports various communication paradigms, including functions, generators, and observables.

## Features

*   **Function Calls:** Invoke remote functions with arguments and receive their return values.
*   **Generators:** Execute remote generators and iterate over the yielded values (no support for sending data bi-directionally with next()). 
*   **Observables:** Subscribe to remote observables and react to emitted values and events.
*   **Flexible Transport:**  r-rpc can be adapted to different communication channels by implementing the transport interfaces.
*   **Type Safety:**  TypeScript definitions ensure type safety and improve developer experience.
*   **Layered API:**  Provides both high-level and low-level APIs for flexibility and control. 

## Getting Started

**Installation:**

\`\`\`bash
npm install r-rpc
\`\`\`

### Setup - Creating Router and Client

**Server (Router):**

\`\`\`typescript
import { createRouter } from 'r-rpc';

// Replace with your actual transport listener and responder
const router = createRouter(/* transport listener */, /* transport responder */); 
router.bind(); // Start listening for requests
\`\`\`

**Client:**

\`\`\`typescript
import { createClient } from 'r-rpc';

// Replace with your actual transport invoker
const client = createClient(/* transport invoker */);
\`\`\`

### High-Level API - Proxies and Services

**Server (Service Registration):**

**Example: Service with Multiple Methods and Return Types**

\`\`\`typescript
import { registerService } from 'r-rpc';
import { Observable } from 'rxjs';

const service = {
  sum(a: number, b: number): number {
    return a + b;
  },
  concat(a: string, b: string): string {
    return a + b; 
  },
  *numbers(max): Iterable<number> {
    let i = 0;
    while(i < max) {
      yield i++;
    }
  },
  async delayedSum(a: number, b: number): Promise<number> {
    await new Promise((r) => setTimeout(r, 100)); // Simulate delay
    return a + b;
  }, 
  events(initialValue: number): Observable<number> {
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
\`\`\`

**Client (Proxy Usage):**

\`\`\`typescript
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
\`\`\`

### Low-Level API - Direct Function Calls

\`\`\`typescript
// Client-side:
type sumFunction = (a: number, b: number) => number
const sumResult = await client.functionRef<sumFunction>('some-service/sum')(5, 10);

// Server-side:
router.addRoute('some-service/sum', (a, b) => { a + b});
\`\`\`

## Architecture 

r-rpc separates the concerns of transport, routing, and service definition. 

*   **Transport:** You provide implementations for sending and receiving messages over a specific communication channel. 
*   **Router (Server):** The router maps incoming requests to registered functions or services.
*   **Client:** The client provides methods for invoking remote functions, generators, and observables. 
*   **Proxy (Client):** A high-level abstraction for interacting with services as if they were local objects.

## Early Stage Notice

While r-rpc is used in a real production application, it is still under development and may have limitations or undergo changes. Feedback and contributions are welcome!

## License

[MIT](LICENSE)
`;