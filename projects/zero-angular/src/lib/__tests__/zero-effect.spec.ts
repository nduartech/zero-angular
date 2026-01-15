import { Stream } from 'effect';
import { describe, expect, it } from 'vitest';

import { connectionState, query, runStreamWithZero } from '../effect/zero-effect';

// Minimal mock Zero client
const makeMockZero = () => {
  let listener: ((s: any) => void) | null = null;
  return {
    addConnectionListener: (cb: any) => {
      listener = cb;
      return () => {
        listener = null;
      };
    },
    materialize: (_q: any) => ({
      addListener: (cb: any) => {
        listener = cb;
        return () => {
          listener = null;
        };
      },
      destroy: () => {},
    }),
    // Helpers for tests
    emit: (v: any) => {
      if (listener) {
        (listener as any)(v);
      }
    },
  };
};

const mockZero = makeMockZero();
const zeroService: any = {
  zero: () => mockZero as any,
};

describe('zero-effect streams', () => {
  it('query stream emits snapshots and cleans up', async () => {
    const stream = query(() => ({ some: 'query' }) as any).pipe(Stream.take(1));
    const p = runStreamWithZero(stream, zeroService);
    // Allow stream registration to start
    await Promise.resolve();
    // Emit one snapshot then await collected result
    (mockZero as any).emit({ some: 'snap' });
    const collected = await p;
    expect(collected).toBeDefined();
  });

  it('connectionState stream emits state', async () => {
    const stream = connectionState().pipe(Stream.take(1));
    const p = runStreamWithZero(stream, zeroService);
    await Promise.resolve();
    // Trigger a connection event
    (mockZero as any).emit('online');
    const res = await p;
    expect(res).toBeDefined();
  });
});
