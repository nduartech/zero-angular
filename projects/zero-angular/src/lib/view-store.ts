import { signal } from '@angular/core';
import type {
  CustomMutatorDefs,
  Entry,
  ErroredQuery,
  HumanReadable,
  Query as QueryDef,
  QueryResultDetails,
  Schema,
  TTL,
  TypedView,
} from '@rocicorp/zero';
import { asQueryInternals } from '@rocicorp/zero/bindings';

import type { ZeroService } from './zero.service';

export type ResultType = 'unknown' | 'complete' | 'error';

export class ViewStore {
  private views = new Map<string, ViewWrapper<any, any, any, any>>();

  // Helper for dynamic/loose calls where the query types are not known at
  // The callsite (for example, from runtime-injected callers). This centralizes
  // The unavoidable type assertions in one place and makes it easier to audit.
  // The bridge remains intentionally to avoid scattering runtime casts across
  // The codebase; remove when callers can provide generics.
  getViewAny(zeroService: any, query: any, enabled = true) {
    return this.getView<any, any, any, any>(zeroService, query, enabled);
  }

  getView<
    TTable extends keyof TSchema['tables'] & string,
    TSchema extends Schema,
    TReturn,
    MD extends CustomMutatorDefs | undefined = undefined,
  >(
    zeroService: ZeroService<TSchema, MD>,
    query: QueryDef<TTable, TSchema, TReturn>,
    enabled = true,
  ): ViewWrapper<TTable, TSchema, TReturn, MD> {
    if (!enabled) {
      return new ViewWrapper({
        enabled: false,
        onDematerialized: () => {},
        onMaterialized: () => {},
        query,
        zeroService,
      });
    }

    // Use proper query hashing like Svelte implementation
    const hash = asQueryInternals(query).hash();

    let existing = this.views.get(hash) as ViewWrapper<TTable, TSchema, TReturn, MD> | undefined;

    if (!existing) {
      existing = new ViewWrapper({
        enabled: true,
        onDematerialized: () => this.views.delete(hash),
        onMaterialized: (view) => {
          const lastView = this.views.get(hash);
          if (lastView && lastView !== view) {
            throw new Error('View already exists');
          }
          this.views.set(hash, view);
        },
        query,
        zeroService,
      });
      this.views.set(hash, existing);
    }

    return existing;
  }
}

interface ViewWrapperOptions<
  TTable extends keyof TSchema['tables'] & string,
  TSchema extends Schema,
  TReturn,
  MD extends CustomMutatorDefs | undefined,
> {
  enabled: boolean;
  onDematerialized: () => void;
  onMaterialized: (view: ViewWrapper<TTable, TSchema, TReturn, MD>) => void;
  query: QueryDef<TTable, TSchema, TReturn>;
  zeroService: ZeroService<TSchema, MD>;
}

const emptyHumanReadable = <T>(): HumanReadable<T> => [] as unknown as HumanReadable<T>;

export class ViewWrapper<
  TTable extends keyof TSchema['tables'] & string,
  TSchema extends Schema,
  TReturn,
  MD extends CustomMutatorDefs | undefined = undefined,
> {
  private view: TypedView<HumanReadable<TReturn>> | undefined;
  private data = signal<Entry>({ '': undefined });
  private status = signal<QueryResultDetails>({ type: 'unknown' });
  private cleanup?: () => void;
  private removeListener?: () => void;
  private updateListeners = new Set<() => void>();

  private zeroService: ZeroService<TSchema, MD>;
  private query: QueryDef<TTable, TSchema, TReturn>;
  private onMaterialized: (view: ViewWrapper<TTable, TSchema, TReturn, MD>) => void;
  private onDematerialized: () => void;
  private enabled: boolean;

  constructor(options: ViewWrapperOptions<TTable, TSchema, TReturn, MD>) {
    this.zeroService = options.zeroService;
    this.query = options.query;
    this.onMaterialized = options.onMaterialized;
    this.onDematerialized = options.onDematerialized;
    this.enabled = options.enabled;
    // Initialize the data based on query format (singular vs plural)
    const internals = asQueryInternals(this.query);
    const initialData: HumanReadable<TReturn> | undefined = internals.format.singular
      ? undefined
      : emptyHumanReadable<TReturn>();
    this.data.set({ '': initialData });

    this.initializeView();
  }

  private initializeView(): void {
    if (!this.enabled) {
      return;
    }

    const zero = this.zeroService.zero();
    if (!zero) {
      return;
    }

    // Materialize the view
    this.view = zero.materialize(this.query);

    // Set up listener for view updates
    const removeListener = this.view.addListener((snap, resultType, error) => {
      this.onData(snap as HumanReadable<TReturn>, resultType as ResultType, error);
      // Notify any external listeners (e.g., inject-query) that data changed
      for (const cb of Array.from(this.updateListeners)) {
        cb();
      }
    });

    this.removeListener = removeListener;

    // Store cleanup function
    this.cleanup = () => {
      this.removeListener?.();
      this.view?.destroy();
      this.view = undefined;
      this.removeListener = undefined;
      this.onDematerialized();
    };

    this.onMaterialized(this);
  }

  addUpdateListener(cb: () => void) {
    this.updateListeners.add(cb);
    return () => this.updateListeners.delete(cb);
  }

  private onData = (
    snap: HumanReadable<TReturn>,
    resultType: ResultType,
    error?: ErroredQuery,
  ): void => {
    // Update data
    this.data.set({ '': snap });

    // Convert ResultType to QueryResultDetails and surface real error information
    if (resultType === 'error') {
      const message = error?.message ?? 'Query error occurred';
      const type = (error as any)?.error ?? 'app';
      const details = (error as any)?.details;

      this.status.set({
        error: {
          message,
          type,
          ...(details && { details }),
        },
        refetch: () => {
          // Soft re-initialize the underlying view without calling onDematerialized
          this.removeListener?.();
          this.view?.destroy();
          this.view = undefined;
          this.removeListener = undefined;
          this.initializeView();
        },
        retry: () => {
          // Retry uses the same logic as refetch for now.
          this.removeListener?.();
          this.view?.destroy();
          this.view = undefined;
          this.removeListener = undefined;
          this.initializeView();
        },
        type: 'error',
      });
    } else {
      this.status.set({ type: resultType });
    }
  };

  // Access data without triggering subscription
  get dataOnly(): HumanReadable<TReturn> {
    return (this.data()[''] as HumanReadable<TReturn>) || emptyHumanReadable<TReturn>();
  }

  get detailsOnly(): QueryResultDetails {
    return this.status();
  }

  // Get current data and details as a tuple (for compatibility)
  get current(): readonly [HumanReadable<TReturn>, QueryResultDetails] {
    return [this.dataOnly, this.detailsOnly];
  }

  // Manually ensure subscription is active (like Svelte's ensureSubscribed)
  ensureSubscribed(): void {
    this.initializeView();
  }

  // Update TTL on the underlying view if supported
  updateTTL(ttl: TTL): void {
    try {
      // TypedView implementations expose updateTTL. Use `any` to avoid strict typing
      (this.view as any)?.updateTTL?.(ttl);
    } catch {
      // No-op if the underlying view doesn't support it
    }
  }

  // Cleanup method
  destroy(): void {
    this.cleanup?.();
  }
}
