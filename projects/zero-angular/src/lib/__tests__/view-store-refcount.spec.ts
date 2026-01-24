import { ViewStore } from '../view-store';

import { describe, expect, it, vi } from 'vitest';

describe('ViewStore', () => {
  it('does not destroy shared view until last release', () => {
    const destroy = vi.fn();
    const removeListener = vi.fn(() => {});

    const zeroService: any = {
      zero: () => ({
        materialize: (_q: any) => ({
          addListener: (_cb: any) => removeListener,
          destroy,
        }),
      }),
    };

    const store = new ViewStore();
    const q = { some: 'query' } as any;

    const a = store.getViewAny(zeroService, q, true, 'k');
    const b = store.getViewAny(zeroService, q, true, 'k');

    a.destroy();
    expect(destroy).not.toHaveBeenCalled();

    b.destroy();
    expect(destroy).toHaveBeenCalledTimes(1);
  });
});
