import { createRouter, createClient, registerService, createProxy } from "../core/index.js";
import { createMemoryChannel } from "../channels/memoryChannel.js";
import EventEmitter from "node:events";
import {
  routerFunctionRefMiddleware,
  clientFunctionRefMiddleware,
  release,
} from "./ref-functions.js";
import { listRoutes } from "../core/utils/debug.js";

describe("experimental - ref functions", () => {
  let router: ReturnType<typeof createRouter>;
  let client: ReturnType<typeof createClient>;
  beforeEach(() => {
    const e1 = new EventEmitter();
    const e2 = new EventEmitter();
    const server = createMemoryChannel(e1, e2);
    const sender = createMemoryChannel(e2, e1);
    router = routerFunctionRefMiddleware(createRouter());
    client = clientFunctionRefMiddleware(createClient(sender.send));
    router.bind(server.onCall, server.respond);
  });

  it("should be able to pass function refs in return", async () => {
    const createCounter = () => {
      let count = 0;
      return () => ++count;
    };

    router.addRoute("counter", createCounter);
    const inc = await client.functionRef<typeof createCounter>("counter")();
    await inc();
    expect(await inc()).toEqual(2);
  });

  it("should be able to pass function refs in objects", async () => {
    const createCounter = () => {
      let counts = [0, 0];
      return {
        incA: () => ++counts[0],
        incB: () => ++counts[1],
      };
    };

    router.addRoute("counter", createCounter);
    const counters = await client.functionRef<typeof createCounter>(
      "counter"
    )();
    await Promise.all([counters.incA(), counters.incB()]);
    await counters.incB();
    expect(await Promise.all([counters.incA(), counters.incB()])).toEqual([
      2, 3,
    ]);
  });

  it("should be able to pass function refs in arrays", async () => {
    const createCounter = () => {
      let counts = [0, 0];
      return [() => ++counts[0], () => ++counts[1]] as const;
    };

    router.addRoute("counter", createCounter);
    const [incA, incB] = await client.functionRef<typeof createCounter>(
      "counter"
    )();
    await Promise.all([incA(), incB()]);
    await incB();
    expect(await Promise.all([incA(), incB()])).toEqual([2, 3]);
  });

  it("should be able to pass function refs in function returns", async () => {
    const createCounter = (start: number) => {
      return (step: number) => {
        let count = start;
        return () => (count += step);
      };
    };

    router.addRoute("counter", createCounter);
    const counterGenerator = await client.functionRef<typeof createCounter>(
      "counter"
    )(10);
    const counterSlow = await counterGenerator(2);
    const counterFast = await counterGenerator(5);
    expect(await Promise.all([counterFast(), counterSlow()])).toEqual([15, 12]);
  });

  it("should be able to clean routes/closures manually from client", async () => {
    const createCounter = () => {
      let count = 0;
      return () => ++count;
    };

    router.addRoute("counter", createCounter);
    const inc = await client.functionRef<typeof createCounter>("counter")();
    expect(listRoutes(router, "/fns").length).toEqual(1);
    expect(await inc()).toEqual(1);
    release(inc)
    expect(listRoutes(router, "/fns").length).toEqual(0);
  });

  it("should be able to clean routes/closures based on client GC", async () => {
    const createCounter = () => {
      let count = 0;
      return () => ++count;
    };

    router.addRoute("counter", createCounter);

    await (async function () {
      const inc = await client.functionRef<typeof createCounter>("counter")();
      expect(listRoutes(router, "/fns").length).toEqual(1);
      await inc();
    })();

    (global as any).gc();
    await new Promise((r) => setTimeout(r, 50));
    expect(listRoutes(router, "/fns").length).toEqual(0);
  });

  it("should work properly with proxy - func", async () => {
    const service = {
      createCounter: ()=> {
        let count = 0;
        return () => ++count;
      }
    };

    registerService(router, "my-service", service);
    const proxy = createProxy<typeof service>(client, "my-service");
    const inc = await proxy.createCounter();
    await inc();
    expect(await inc()).toEqual(2);
  });

  it("should work properly with proxy - object", async () => {
    const service = {
        createCounter: ()=> {
            let count = 0;
            return {
                inc: () => ++count,
                dec: () => --count,
                current: () => count
            }
          }
    };

    registerService(router, "my-service", service);
    const proxy = createProxy<typeof service>(client, "my-service");
    const counter = await proxy.createCounter();
    await counter.inc();
    await counter.inc();
    await counter.inc();
    await counter.dec();
    expect(await counter.current()).toEqual(2);
  });
});
