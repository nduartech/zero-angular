import { DestroyRef, computed, effect, inject, signal } from '@angular/core';
import type { AnyQuery, HumanReadable, QueryResultDetails } from '@rocicorp/zero';

import type { QueryOptions, QueryResult } from './types';
import { ViewStore, type ViewWrapper } from './view-store';
import { ZeroService } from './zero.service';

// Global view store instance
const globalViewStore = new ViewStore();

const injectQuery = <TReturn>(
  queryFn: () => AnyQuery | undefined,
  options?: QueryOptions,
): QueryResult<TReturn> => {
  const zeroService = inject(ZeroService),
    data = signal<HumanReadable<TReturn> | undefined>(undefined),
    details = signal<QueryResultDetails>({ type: 'unknown' }),
    queryComputed = computed(() => queryFn());

  let currentQuery = queryComputed(),
    viewWrapper: ViewWrapper<any, any, any, any> | undefined = undefined;

  const updateSignalsFromView = () => {
    if (!viewWrapper) {
      return;
    }
    const currentData = viewWrapper.dataOnly as unknown as HumanReadable<TReturn>;
    data.set(currentData);
    details.set(viewWrapper.detailsOnly);
  };

  let removeViewUpdateListener: (() => void) | undefined = undefined;

  const attachViewWrapper = (qry: AnyQuery, enabledParam = true) => {
    // Clean up any previous listener
    removeViewUpdateListener?.();
    viewWrapper = globalViewStore.getViewAny(zeroService, qry, enabledParam);
    // Subscribe to view updates so signals stay in sync
    if ((viewWrapper as any)?.addUpdateListener) {
      removeViewUpdateListener = (viewWrapper as any).addUpdateListener(updateSignalsFromView);
    }
    updateSignalsFromView();
  };

  if (currentQuery) {
    attachViewWrapper(currentQuery, true);
    // Ensure underlying view subscription is active when created
    if ((viewWrapper as any)?.ensureSubscribed) {
      (viewWrapper as any).ensureSubscribed();
    }
  }

  // Reactive subscription: watch computed query and update attached view
  effect(() => {
    const newQuery = queryComputed();
    if (newQuery === currentQuery) {
      return;
    }
    // `updateQuery` behavior: attach new view or clear when falsy
    if (newQuery) {
      // Preserve previous enabled state as true
      attachViewWrapper(newQuery, true);
      updateSignalsFromView();
      if ((viewWrapper as any)?.ensureSubscribed) {
        (viewWrapper as any).ensureSubscribed();
      }
    } else {
      removeViewUpdateListener?.();
      data.set(undefined);
      details.set({ type: 'unknown' });
      viewWrapper?.destroy();
      viewWrapper = undefined;
    }
    currentQuery = newQuery;
  });

  // If options.ttl is provided and is reactive, watch it and call updateTTL
  if (options && 'ttl' in options) {
    // Create a computed to read ttl for reactivity
    const ttlComputed = computed(() => options.ttl);
    let lastTTL = ttlComputed();
    effect(() => {
      const newTTL = ttlComputed();
      if (newTTL === lastTTL) {
        return;
      }
      lastTTL = newTTL;
      if (viewWrapper && typeof viewWrapper.updateTTL === 'function' && newTTL !== undefined) {
        try {
          (viewWrapper as any).updateTTL(newTTL);
        } catch {
          // Ignore
        }
      }
    });
  }

  const destroyRef = inject(DestroyRef);
  destroyRef.onDestroy?.(() => {
    removeViewUpdateListener?.();
    viewWrapper?.destroy();
  });

  // Return object with methods for query management (like Svelte Query class)
  return {
    data,
    destroy() {
      viewWrapper?.destroy();
      viewWrapper = undefined;
    },
    details,
    updateQuery(newQuery: AnyQuery | undefined, enabled = true) {
      currentQuery = newQuery;
      if (currentQuery) {
        attachViewWrapper(currentQuery, enabled);
        // Update signals with new view data
        updateSignalsFromView();
      } else {
        // No query, reset to undefined
        removeViewUpdateListener?.();
        data.set(undefined);
        details.set({ type: 'unknown' });
        viewWrapper?.destroy();
        viewWrapper = undefined;
      }
    },
  };
};

export { injectQuery };
