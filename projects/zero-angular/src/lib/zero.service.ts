import { Injectable, type WritableSignal, signal } from '@angular/core';
import {
  type CustomMutatorDefs,
  type DefaultContext,
  type DefaultSchema,
  type HumanReadable,
  type PullRow,
  type QueryOrQueryRequest,
  type ReadonlyJSONValue,
  type RunOptions,
  type TTL,
  type TypedView,
  type Zero,
  Zero as ZeroClass,
} from '@rocicorp/zero';
import type { ZeroProviderOptions } from './types';

@Injectable({ providedIn: 'root' })
export class ZeroService<
  SchemaType extends DefaultSchema = DefaultSchema,
  MutatorDefs extends CustomMutatorDefs | undefined = undefined,
  ContextType = DefaultContext,
> {
  readonly zero: WritableSignal<Zero<SchemaType, MutatorDefs, ContextType> | undefined> =
    signal(undefined);

  private _createdInternally = false;

  provide(options: ZeroProviderOptions<SchemaType, MutatorDefs, ContextType>): void {
    if ('zero' in options) {
      this._createdInternally = false;
      this.zero.set(options.zero);
      return;
    }

    const opts = options;
    const zeroClient = new ZeroClass(opts);
    this._createdInternally = true;
    this.zero.set(zeroClient);
  }

  async close(): Promise<void> {
    const zeroClient = this.zero();
    if (!zeroClient) {
      return;
    }

    // If we created the client internally and it implements `close`, call it.
    if (this._createdInternally && typeof (zeroClient as any).close === 'function') {
      const maybeCloseable = zeroClient as { close: () => Promise<void> };
      await maybeCloseable.close();
      this.zero.set(undefined);
    }
  }

  // Additional Zero methods exposed like Svelte implementation
  preload<
    TTable extends keyof SchemaType['tables'] & string,
    TInput extends ReadonlyJSONValue | undefined,
    TOutput extends ReadonlyJSONValue | undefined,
    TReturn = PullRow<TTable, SchemaType>,
    TContext = ContextType,
  >(
    query: QueryOrQueryRequest<TTable, TInput, TOutput, SchemaType, TReturn, TContext>,
    options?: {
      ttl?: TTL | undefined;
    },
  ): { cleanup: () => void; complete: Promise<void> } {
    const zeroClient = this.zero();
    if (!zeroClient) {
      throw new Error('Zero instance not available');
    }
    return zeroClient.preload(query as any, options);
  }

  run<
    TTable extends keyof SchemaType['tables'] & string,
    TInput extends ReadonlyJSONValue | undefined,
    TOutput extends ReadonlyJSONValue | undefined,
    TReturn = PullRow<TTable, SchemaType>,
    TContext = ContextType,
  >(
    query: QueryOrQueryRequest<TTable, TInput, TOutput, SchemaType, TReturn, TContext>,
    runOptions?: RunOptions,
  ): Promise<HumanReadable<TReturn>> {
    const zeroClient = this.zero();
    if (!zeroClient) {
      throw new Error('Zero instance not available');
    }
    return zeroClient.run(query as any, runOptions);
  }

  materialize<
    TTable extends keyof SchemaType['tables'] & string,
    TInput extends ReadonlyJSONValue | undefined,
    TOutput extends ReadonlyJSONValue | undefined,
    TReturn = PullRow<TTable, SchemaType>,
    TContext = ContextType,
  >(
    query: QueryOrQueryRequest<TTable, TInput, TOutput, SchemaType, TReturn, TContext>,
  ): TypedView<HumanReadable<TReturn>> {
    const zeroClient = this.zero();
    if (!zeroClient) {
      throw new Error('Zero instance not available');
    }
    return zeroClient.materialize(query as any);
  }

  // Query helper methods for compatibility with other Zero bindings.
  q<
    TTable extends keyof SchemaType['tables'] & string,
    TInput extends ReadonlyJSONValue | undefined,
    TOutput extends ReadonlyJSONValue | undefined,
    TReturn = PullRow<TTable, SchemaType>,
    TContext = ContextType,
  >(query: QueryOrQueryRequest<TTable, TInput, TOutput, SchemaType, TReturn, TContext>) {
    return query;
  }

  createQuery<
    TTable extends keyof SchemaType['tables'] & string,
    TInput extends ReadonlyJSONValue | undefined,
    TOutput extends ReadonlyJSONValue | undefined,
    TReturn = PullRow<TTable, SchemaType>,
    TContext = ContextType,
  >(query: QueryOrQueryRequest<TTable, TInput, TOutput, SchemaType, TReturn, TContext>) {
    return query;
  }
}
