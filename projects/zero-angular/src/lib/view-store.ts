import { Injectable, signal } from '@angular/core';
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

import type { ZeroService } from './zero.service';

export type ResultType = 'unknown' | 'complete' | 'error';

@Injectable({ providedIn: 'root' })
export class ViewStore {
  private viewsByKey = new Map<string, ViewRecord<any, any, any, any>>();
  private viewsByQuery = new WeakMap<object, ViewRecord<any, any, any, any>>();

  // Helper for dynamic/loose calls where the query types are not known at
  // the callsite (for example, from runtime-injected callers). This centralizes
  // the unavoidable type assertions in one place and makes it easier to audit.
  getViewAny(zeroService: any, query: any, enabled = true, key?: string) {
    return this.getView<any, any, any, any>(zeroService, query, enabled, key);
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
    key?: string,
  ): ViewWrapper<TTable, TSchema, TReturn, MD> {
    if (!enabled) {
      const shared = new SharedViewWrapper({ enabled: false, query, zeroService });
      return new ViewWrapper({ shared, onRelease: () => {} });
    }

    const release = (
      record: ViewRecord<TTable, TSchema, TReturn, MD>,
      removeFromCaches: () => void,
    ) => {
      record.refs -= 1;
      if (record.refs > 0) {
        return;
      }
      removeFromCaches();
      record.shared.finalize();
    };

    const getOrCreate = (
      lookup: () => ViewRecord<TTable, TSchema, TReturn, MD> | undefined,
      store: (r: ViewRecord<TTable, TSchema, TReturn, MD>) => void,
      removeFromCaches: (q: QueryDef<TTable, TSchema, TReturn>) => void,
    ) => {
      const existing = lookup();
      if (existing) {
        existing.refs += 1;
        existing.shared.ensureSubscribed();
        return new ViewWrapper({
          shared: existing.shared,
          onRelease: () => release(existing, () => removeFromCaches(query)),
        });
      }

      const record: ViewRecord<TTable, TSchema, TReturn, MD> = {
        refs: 1,
        shared: new SharedViewWrapper({ enabled: true, query, zeroService }),
      };
      store(record);
      record.shared.ensureSubscribed();
      return new ViewWrapper({
        shared: record.shared,
        onRelease: () => release(record, () => removeFromCaches(query)),
      });
    };

    if (key) {
      return getOrCreate(
        () => this.viewsByKey.get(key) as ViewRecord<TTable, TSchema, TReturn, MD> | undefined,
        (r) => this.viewsByKey.set(key, r as ViewRecord<any, any, any, any>),
        () => {
          try {
            this.viewsByKey.delete(key);
          } catch {}
        },
      );
    }

    if (query && typeof query === 'object') {
      return getOrCreate(
        () => this.viewsByQuery.get(query as object) as ViewRecord<TTable, TSchema, TReturn, MD> | undefined,
        (r) => this.viewsByQuery.set(query as object, r as ViewRecord<any, any, any, any>),
        (q) => {
          try {
            if (q && typeof q === 'object') {
              this.viewsByQuery.delete(q as object);
            }
          } catch {}
        },
      );
    }

    const record: ViewRecord<TTable, TSchema, TReturn, MD> = {
      refs: 1,
      shared: new SharedViewWrapper({ enabled: true, query, zeroService }),
    };
    record.shared.ensureSubscribed();
    return new ViewWrapper({
      shared: record.shared,
      onRelease: () => release(record, () => {}),
    });
  }
}

interface ViewRecord<
  TTable extends keyof TSchema['tables'] & string,
  TSchema extends Schema,
  TReturn,
  MD extends CustomMutatorDefs | undefined,
> {
  refs: number;
  shared: SharedViewWrapper<TTable, TSchema, TReturn, MD>;
}

interface SharedViewWrapperOptions<
  TTable extends keyof TSchema['tables'] & string,
  TSchema extends Schema,
  TReturn,
  MD extends CustomMutatorDefs | undefined,
> {
  enabled: boolean;
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
  private released = false;
  private shared: SharedViewWrapper<TTable, TSchema, TReturn, MD>;
  private onRelease: () => void;

  constructor(options: {
    shared: SharedViewWrapper<TTable, TSchema, TReturn, MD>;
    onRelease: () => void;
  }) {
    this.shared = options.shared;
    this.onRelease = options.onRelease;
  }

  addUpdateListener(cb: () => void) {
    return this.shared.addUpdateListener(cb);
  }

  get dataOnly(): HumanReadable<TReturn> {
    return this.shared.dataOnly;
  }

  get detailsOnly(): QueryResultDetails {
    return this.shared.detailsOnly;
  }

  get current(): readonly [HumanReadable<TReturn>, QueryResultDetails] {
    return this.shared.current;
  }

  ensureSubscribed(): void {
    this.shared.ensureSubscribed();
  }

  updateTTL(ttl: TTL): void {
    this.shared.updateTTL(ttl);
  }

  destroy(): void {
    if (this.released) {
      return;
    }
    this.released = true;
    try {
      this.onRelease();
    } catch {
      // Ignore
    }
  }
}

class SharedViewWrapper<
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
  private enabled: boolean;
  private pendingTTL: TTL | undefined;
  private initPending = false;

  constructor(options: SharedViewWrapperOptions<TTable, TSchema, TReturn, MD>) {
    this.zeroService = options.zeroService;
    this.query = options.query;
    this.enabled = options.enabled;
    this.data.set({ '': undefined });
    this.initializeView();
  }

  private initializeView(): void {
    if (!this.enabled) {
      return;
    }
    if (this.view || this.initPending) {
      return;
    }

    const zero = this.zeroService.zero();
    if (!zero) {
      return;
    }

    this.initPending = true;
    this.view = zero.materialize(this.query);
    this.initPending = false;

    if (this.pendingTTL !== undefined) {
      this.updateTTL(this.pendingTTL);
    }

    const removeListener = this.view.addListener((snap, resultType, error) => {
      this.onData(snap as HumanReadable<TReturn>, resultType as ResultType, error);
      for (const cb of Array.from(this.updateListeners)) {
        cb();
      }
    });
    this.removeListener = removeListener;

    this.cleanup = () => {
      this.removeListener?.();
      this.view?.destroy();
      this.view = undefined;
      this.removeListener = undefined;
    };
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
    this.data.set({ '': snap });

    if (resultType === 'error') {
      const message = error?.message ?? 'Query error occurred';
      const type = error?.error ?? 'app';
      const details = error?.details;

      this.status.set({
        error: {
          message,
          type,
          ...(details && { details }),
        },
        refetch: () => {},
        retry: () => {},
        type: 'error',
      });
    } else {
      this.status.set({ type: resultType });
    }
  };

  get dataOnly(): HumanReadable<TReturn> {
    return (this.data()[''] as HumanReadable<TReturn>) || emptyHumanReadable<TReturn>();
  }

  get detailsOnly(): QueryResultDetails {
    return this.status();
  }

  get current(): readonly [HumanReadable<TReturn>, QueryResultDetails] {
    return [this.dataOnly, this.detailsOnly];
  }

  ensureSubscribed(): void {
    this.initializeView();
  }

  updateTTL(ttl: TTL): void {
    this.pendingTTL = ttl;
    try {
      (this.view as UpdateTTLView<HumanReadable<TReturn>> | undefined)?.updateTTL?.(ttl);
    } catch {
      // No-op
    }
  }

  finalize(): void {
    this.cleanup?.();
  }
}

type UpdateTTLView<T> = TypedView<T> & {
  updateTTL?: (ttl: TTL) => void;
};
