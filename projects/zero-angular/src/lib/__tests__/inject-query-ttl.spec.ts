import {
  NgZone,
  ɵEffectScheduler as EffectScheduler,
  ɵChangeDetectionScheduler as ChangeDetectionScheduler,
  ɵNoopNgZone as NoopNgZone,
  createEnvironmentInjector,
  signal,
} from '@angular/core';
import { describe, expect, it, vi } from 'vitest';

import { injectQuery } from '../inject-query';
import { ViewStore } from '../view-store';
import { ZeroService } from '../zero.service';

describe('injectQuery ttl', () => {
  it('calls updateTTL when ttl signal changes', async () => {
    const updateTTL = vi.fn();
    const destroy = vi.fn();
    const removeListener = vi.fn(() => {});

    const zeroServiceMock: any = {
      zero: vi.fn(() => ({
        materialize: (_q: any) => ({
          addListener: (_cb: any) => removeListener,
          destroy,
          updateTTL,
        }),
      })),
    };

    class TestChangeDetectionScheduler {
      runningTick = false;
      notify() {}
    }

    class TestEffectScheduler {
      private queued = new Set<any>();
      private flushQueued = false;

      add(e: any) {
        this.schedule(e);
      }

      schedule(e: any) {
        this.queued.add(e);
        if (this.flushQueued) {
          return;
        }
        this.flushQueued = true;
        queueMicrotask(() => this.flush());
      }

      flush() {
        this.flushQueued = false;
        const toRun = Array.from(this.queued);
        this.queued.clear();
        for (const e of toRun) {
          try {
            e.run();
          } catch {
            // Ignore
          }
        }
      }

      remove(e: any) {
        this.queued.delete(e);
      }
    }

    const injector = createEnvironmentInjector(
      [
        { provide: ChangeDetectionScheduler, useClass: TestChangeDetectionScheduler },
        { provide: EffectScheduler, useClass: TestEffectScheduler },
        { provide: NgZone, useClass: NoopNgZone },
        { provide: ViewStore, useValue: new ViewStore() },
        { provide: ZeroService, useValue: zeroServiceMock },
      ],
      null,
    );

    try {
      await injector.runInContext(async () => {
      const ttl = signal<number | undefined>(1);
      injectQuery(() => ({ some: 'query' }) as any, { key: 'k', ttl });
      await tick();

      ttl.set(2);
      await tick();
      expect(updateTTL).toHaveBeenCalled();
      });
    } finally {
      injector.destroy();
    }
  });
});

const tick = async () => {
  await Promise.resolve();
};
