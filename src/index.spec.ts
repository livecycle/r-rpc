import { EventEmitter } from 'events';
import { Observable, toArray } from 'rxjs';
import { createMemoryChannel } from './channels/memoryChannel.js';
import { createClient, createProxy, createRouter, registerService } from './core/index.js';

describe('rpc tests', () => {
  let router: ReturnType<typeof createRouter>;
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    const e1 = new EventEmitter();
    const e2 = new EventEmitter();
    const server = createMemoryChannel(e1, e2);
    const sender = createMemoryChannel(e2, e1);
    router = createRouter(server.onCall, server.respond);
    client = createClient(sender.send);
    router.bind();
  });

  describe('simple routing', () => {
    it('should call function and return result', async () => {
      const fn = (a: number, b: number) => a + b;
      router.addRoute('test', fn);
      const result = await client.functionRef<typeof fn>('test')(5, 10);
      expect(result).toBe(15);
    });

    it('should support return arrays', async () => {
      const fn = (a: number, b: number) => [a, b];
      router.addRoute('test', fn);
      const result = await client.functionRef<typeof fn>('test')(5, 10);
      expect(result).toEqual([5, 10]);
    });

    it('should able to call multiple times with right results', async () => {
      const fn = (a: number, b: number) => a + b;
      router.addRoute('test', fn);
      const ref = client.functionRef<typeof fn>('test');
      const p1 = ref(5, 10);
      const p2 = ref(2, 4);
      expect(await p1).toBe(15);
      expect(await p2).toBe(6);
    });

    it('should able to run async function', async () => {
      const fn = async (a: number, b: number) => a + b;
      router.addRoute('test', fn);
      const result = await client.functionRef<typeof fn>('test')(3, 4);
      expect(result).toBe(7);
    });

    describe('error passing', () => {
      describe('synchronous', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const fn = (a: number, b: number) => {
          throw 'hello';
        };
        it('should catch the error', async () => {
          router.addRoute('test', fn);
          try {
            await client.functionRef<typeof fn>('test')(3, 4);
          } catch (ex) {
            expect(ex).toBe('hello');
            return;
          }
          fail("error wasn't caught");
        });
      });

      describe('async', () => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const fn = async (a: number, b: number) => {
          throw 'hello';
        };
        it('should catch the error', async () => {
          router.addRoute('test', fn);
          try {
            await client.functionRef<typeof fn>('test')(3, 4);
          } catch (ex) {
            expect(ex).toBe('hello');
            return;
          }
          fail("error wasn't caught");
        });
      });
    });
    it('should pass errors', async () => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const fn = async (a: number, b: number) => {
        throw 'hello';
      };
      router.addRoute('test', fn);
      try {
        await client.functionRef<typeof fn>('test')(3, 4);
      } catch (ex) {
        expect(ex).toBe('hello');
        return;
      }
      fail("error wasn't caught");
    });

    it('should run iterables', async () => {
      const fn = function* (a: number, b: number) {
        yield a * 2;
        yield b * 2;
      };
      router.addRoute('test', fn);
      const data = [] as number[];
      for await (const n of client.functionGenRef<typeof fn>('test')(3, 4)) {
        data.push(n);
      }
      expect(data).toEqual([6, 8]);
    });

    it('should run async iterables', async () => {
      const fn = async function* (a: number, b: number) {
        yield await Promise.resolve(a * 2);
        yield await Promise.resolve(b * 2);
      };

      router.addRoute('test', fn);
      const data = [] as number[];
      for await (const n of client.functionGenRef<typeof fn>('test')(3, 4)) {
        data.push(n);
      }

      expect(data).toEqual([6, 8]);
    });

    it('should be able to break/cancel async iterables properly', async () => {
      let breakCalled = false;
      const fn = async function* (a: number, b: number) {
        try {
          yield await Promise.resolve(a * 2);
          yield await Promise.resolve(b * 2);
          throw 'should never be called';
        } finally {
          breakCalled = true;
        }
      };

      router.addRoute('test', fn);
      const data = [] as number[];
      for await (const n of client.functionGenRef< typeof fn>('test')(3, 4)) {
        data.push(n);
        if (data.length === 2) {
          break;
        }
      }
      expect(data).toEqual([6, 8]);
      expect(breakCalled).toEqual(true);
    });

    it('should run observable', async () => {
      const fn = (a: number, b: number) => {
        return new Observable((obs) => {
          obs.next(a);
          obs.next(b);
          obs.next(a + b);
          obs.complete();
        });
      };
      router.addRoute('test', fn);
      const obs = client.functionObservableRef<typeof fn>('test')(3, 4);
      expect(await obs.pipe(toArray()).toPromise()).toEqual([3, 4, 7]);
    });
  });

  it('should run propogate error from observable', async () => {
    const fn = () => {
      return new Observable((obs) => {
        obs.error('err');
        obs.complete();
      });
    };
    router.addRoute('test', fn);
    const obs = client.functionObservableRef<typeof fn>('test')();
    try {
      await obs.pipe(toArray()).toPromise();
    } catch (ex) {
      expect(ex).toBe('err');
      return;
    }
  });

  it('should cancel observable', async () => {
    let breakCalled = false;
    const fn = (a: number, b: number) => {
      return new Observable((obs) => {
        return () => {
          breakCalled = true;
        };
      });
    };
    router.addRoute('test', fn);
    const obs = client.functionObservableRef<typeof fn>('test')(3, 4);
    obs.subscribe().unsubscribe();
    expect(breakCalled).toEqual(true);
  });

  it('should be able to resubscribe to observable', async () => {
    const fn = (a: number, b: number) => {
      return new Observable((obs) => {
        obs.next(a);
        obs.next(b);
        obs.next(a + b);
        obs.complete();
      });
    };
    router.addRoute('test', fn);
    const obs = client.functionObservableRef<typeof fn>('test')(3, 4);
    expect(await obs.pipe(toArray()).toPromise()).toEqual([3, 4, 7]);
    //another run
    expect(await obs.pipe(toArray()).toPromise()).toEqual([3, 4, 7]);
  });

  describe('service based routed', () => {
    const service = {
      sum(a: number, b: number): number {
        return a + b;
      },
      minus(a: number, b: number): number {
        return a - b;
      },
      async asyncSum(a: number, b: number): Promise<number> {
        return a + b;
      },
      nested: {
        hello() {
          return 'world';
        },
      },
    };

    it('method invocation', async () => {
      registerService(router, 'test', service);
      let result = await client.functionRef<typeof service['sum']>('test/sum')(3, 4);
      expect(result).toBe(7);
      result = await client.functionRef<typeof service['minus']>('test/minus')(3, 4);
      expect(result).toBe(-1);
    });

    it('primitive field access', async () => {
      const service2 = {
        a: 5,
      };
      registerService(router, 'test', service2);
      const ref = await client.fieldRef<typeof service2['a']>('test/a');
      expect(await ref.get()).toBe(5);
      await ref.set(6);
      expect(await ref.get()).toBe(6);
    });

    it('nested address access', async () => {
      registerService(router, 'test', service);
      const result = await client.functionRef<typeof service['nested']['hello']>('test/nested/hello')();
      expect(result).toBe('world');
    });

    it('use proxy - method invoke', async () => {
      registerService(router, 'test', service);
      const proxy = createProxy<typeof service>(client, 'test');
      const result = await proxy.sum(10, 20);
      expect(result).toBe(30);
    });

    it('use proxy - async method invoke', async () => {
      registerService(router, 'test', service);
      const proxy = createProxy<typeof service>(client, 'test');
      const result = await proxy.asyncSum(10, 20);
      expect(result).toBe(30);
    });

    it('use proxy - field access', async () => {
      const service2 = {
        a: 5,
      };
      registerService(router, 'test', service2);
      const proxy = createProxy<typeof service2>(client, 'test');
      const result = await proxy.a;
      expect(result).toBe(result);
    });

    it('use proxy - async gen/iter', async () => {
      const service2 = {
        async *iter(x: number) {
          yield 1;
          yield x;
          yield 3;
        },
      };
      registerService(router, 'test', service2);
      const proxy = createProxy<typeof service2>(client, 'test');
      const data = [] as number[];
      for await (const n of proxy.iter$Iter(2)) {
        data.push(n);
      }
      expect(data).toEqual([1, 2, 3]);
    });

    it('use proxy - async gen/iter multiplex', async () => {
      const service2 = {
        async *iter() {
          let i = 0;
          while (true) {
            await new Promise((r) => setTimeout(r, 10));
            yield i++;
          }
        },
        async end() {
          await new Promise((r) => setTimeout(r, 100));
          return true;
        },
      };
      registerService(router, 'test', service2);
      const proxy = createProxy<typeof service2>(client, 'test');

      let end = false;
      for await (const n of proxy.iter$Iter()) {
        if (n === 5) {
          proxy.end().then((e) => {
            end = e;
          });
        }
        if (end) {
          break;
        }
      }

      expect(end).toEqual(true);
    });

    it('use proxy - observable', async () => {
      const service2 = {
        events(a: number) {
          return new Observable<number>((obs) => {
            obs.next(a);
            obs.next(++a);
            obs.next(++a);
            obs.complete();
          });
        },
      };
      registerService(router, 'test', service2);
      const proxy = createProxy<typeof service2>(client, 'test');
      const obs = proxy.events$(5);
      expect(await obs.pipe(toArray()).toPromise()).toEqual([5, 6, 7]);
    });

    it('use proxy - observable cancellation', async () => {
      let cancelled = false;
      const service2 = {
        events(a: number) {
          return new Observable<number>((obs) => {
            return () => {
              cancelled = true;
            };
          });
        },
      };
      registerService(router, 'test', service2);
      const proxy = createProxy<typeof service2>(client, 'test');
      const obs = proxy.events$(5);
      obs.subscribe().unsubscribe();
      expect(cancelled).toEqual(true);
    });
  });
});
