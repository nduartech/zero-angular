import type { Signal } from '@angular/core';
import type {
  AnyQuery,
  ConnectionState,
  CustomMutatorDefs,
  DefaultContext,
  DefaultSchema,
  HumanReadable,
  QueryResultDetails,
  Schema,
  TTL,
  Zero,
  ZeroOptions,
} from '@rocicorp/zero';

export interface QueryOptions {
  readonly ttl?: TTL | undefined;
}

export interface QueryResult<TReturn> {
  readonly data: Signal<HumanReadable<TReturn> | undefined>;
  readonly details: Signal<QueryResultDetails>;
  updateQuery(newQuery: AnyQuery | undefined, enabled?: boolean): void;
  destroy(): void;
}

export type ZeroProviderOptions<
  SchemaType extends Schema = DefaultSchema,
  MutatorDefs extends CustomMutatorDefs | undefined = undefined,
  ContextType = DefaultContext,
> =
  | { readonly zero: Zero<SchemaType, MutatorDefs, ContextType> }
  | ZeroOptions<SchemaType, MutatorDefs, ContextType>;

export type ConnectionStateSignal = Signal<ConnectionState | undefined>;
