import { DestroyRef, computed, effect, inject, isSignal, signal } from '@angular/core';
import type { AnyQuery, HumanReadable, QueryResultDetails } from '@rocicorp/zero';

import type { QueryOptions, QueryResult } from './types';
import { ViewStore, type ViewWrapper } from './view-store';
import { ZeroService } from './zero.service';

const injectQuery = <TReturn>(
  queryFn: () => AnyQuery | undefined,
  options?: QueryOptions,
): QueryResult<TReturn> => {
  const zeroService = inject(ZeroService),
    viewStore = inject(ViewStore),
    data = signal<HumanReadable<TReturn> | undefined>(undefined),
    details = signal<QueryResultDetails>({ type: 'unknown' }),
    queryComputed = computed(() => queryFn()),
    enabledSignal = signal(true);

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

    const nextWrapper = viewStore.getViewAny(zeroService, qry, enabledParam, options?.key);
    if (viewWrapper && viewWrapper !== nextWrapper) {
      viewWrapper.destroy();
    }

    viewWrapper = nextWrapper;
    // Subscribe to view updates so signals stay in sync
    if ((viewWrapper as any)?.addUpdateListener) {
      removeViewUpdateListener = (viewWrapper as any).addUpdateListener(updateSignalsFromView);
    }
    updateSignalsFromView();
  };

  if (currentQuery) {
    attachViewWrapper(currentQuery, enabledSignal());
    // Ensure underlying view subscription is active when created
    if ((viewWrapper as any)?.ensureSubscribed) {
      (viewWrapper as any).ensureSubscribed();
    }
  }

  // Reactive subscription: watch query + Zero availability.
  effect(
    () => {
      // Track both dependencies.
      const _zero = zeroService.zero();
      const newQuery = queryComputed();
      const isEnabled = enabledSignal();

      // Disabled => release view but keep last data by default.
      if (!isEnabled) {
        removeViewUpdateListener?.();
        removeViewUpdateListener = undefined;
        viewWrapper?.destroy();
        viewWrapper = undefined;
        details.set({ type: 'unknown' });
        currentQuery = newQuery;
        return;
      }

      // Query removed => full cleanup.
      if (!newQuery) {
        removeViewUpdateListener?.();
        removeViewUpdateListener = undefined;
        data.set(undefined);
        details.set({ type: 'unknown' });
        viewWrapper?.destroy();
        viewWrapper = undefined;
        currentQuery = undefined;
        return;
      }

      // Query changed or first attach.
      if (newQuery !== currentQuery || !viewWrapper) {
        attachViewWrapper(newQuery, true);
        currentQuery = newQuery;
      }

      // Keep signals in sync.
      updateSignalsFromView();

      // If Zero is ready, materialize/subscribe.
      if (_zero && (viewWrapper as any)?.ensureSubscribed) {
        (viewWrapper as any).ensureSubscribed();
      }
    },
  
  );

  const ttlOption = options?.ttl;
  if (ttlOption !== undefined) {
    if (isSignal(ttlOption)) {
      effect(
        () => {
          const ttl = ttlOption();
          if (ttl === undefined) {
            return;
          }
          viewWrapper?.updateTTL?.(ttl);
        },
      
      );
    } else {
      // Apply a non-reactive TTL once; ViewWrapper caches it until materialized.
      (viewWrapper as any)?.updateTTL?.(ttlOption);
    }
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
      enabledSignal.set(enabled);
      currentQuery = newQuery;
      if (currentQuery) {
        if (enabled) {
          attachViewWrapper(currentQuery, true);
        } else {
          removeViewUpdateListener?.();
          removeViewUpdateListener = undefined;
          viewWrapper?.destroy();
          viewWrapper = undefined;
          details.set({ type: 'unknown' });
        }
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
