import { Effect, Stream } from 'effect';
import { describe, expect, it } from 'vitest';

import { ZeroServiceTag, connectionState, query, runQuery, runStreamWithZero } from '../../../effect/src/lib/zero-effect';

// Minimal mock Zero client
const makeMockZero = () => {
  let queryListener: ((s: any) => void) | null = null;
  let connListener: ((s: any) => void) | null = null;
  return {
    connection: {
      state: {
        current: 'unknown' as any,
        subscribe: (cb: any) => {
          connListener = cb;
          return () => {
            connListener = null;
          };
        },
      },
    },
    materialize: (_q: any) => ({
      addListener: (cb: any) => {
        queryListener = cb;
        return () => {
          queryListener = null;
        };
      },
      destroy: () => {},
    }),
    run: async (_q: any) => [{ some: 'ran' }],
    // Helpers for tests
    emitQuery: (v: any) => queryListener?.(v, 'complete'),
    emitConn: (v: any) => connListener?.(v),
  };
};

const mockZero = makeMockZero();
const zeroService: any = {
  zero: () => mockZero as any,
  run: (...args: any[]) => (mockZero as any).run(...args),
  preload: (..._args: any[]) => ({ cleanup: () => {}, complete: Promise.resolve() }),
};

describe('zero-effect streams', () => {
  it('query stream emits snapshots and cleans up', async () => {
    const stream = query(() => ({ some: 'query' }) as any).pipe(Stream.take(1));
    const p = runStreamWithZero(stream, zeroService);
    // Allow stream registration to start
    await Promise.resolve();
    // Emit one snapshot then await collected result
    (mockZero as any).emitQuery({ some: 'snap' });
    const collected = await p;
    expect(collected.length).toBe(1);
  });

  it('connectionState stream emits state', async () => {
    const stream = connectionState().pipe(Stream.take(1));
    const p = runStreamWithZero(stream, zeroService);
    await Promise.resolve();
    // Trigger a connection event
    (mockZero as any).emitConn('online');
    const res = await p;
    expect(res.length).toBe(1);
  });

  it('runQuery runs a one-off query', async () => {
    const eff = runQuery(() => ({ some: 'query' }) as any);
    const res = await Effect.runPromise(eff.pipe(Effect.provideService(ZeroServiceTag, zeroService)));
    expect(res).toEqual([{ some: 'ran' }]);
  });
});
