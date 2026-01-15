import type {
  DefaultContext,
  DefaultSchema,
  PullRow,
  QueryOrQueryRequest,
  ReadonlyJSONValue,
} from '@rocicorp/zero';

// Thin typed helpers to centralize query construction and avoid circular imports.
// This module intentionally only depends on Zero types and provides a stable
// Place for `q()` and `createQuery()` so other modules can import them.

export interface QueryFactory {
  q: <
    TTable extends keyof DefaultSchema['tables'] & string,
    TInput extends ReadonlyJSONValue | undefined,
    TOutput extends ReadonlyJSONValue | undefined,
    TReturn = PullRow<TTable>,
    TContext = DefaultContext,
  >(
    query: QueryOrQueryRequest<TTable, TInput, TOutput, DefaultSchema, TReturn, TContext>,
  ) => QueryOrQueryRequest<TTable, TInput, TOutput, DefaultSchema, TReturn, TContext>;
}

export function q<
  TTable extends keyof DefaultSchema['tables'] & string,
  TInput extends ReadonlyJSONValue | undefined,
  TOutput extends ReadonlyJSONValue | undefined,
  TReturn = PullRow<TTable>,
  TContext = DefaultContext,
>(query: QueryOrQueryRequest<TTable, TInput, TOutput, DefaultSchema, TReturn, TContext>) {
  return query;
}

export function createQuery<
  TTable extends keyof DefaultSchema['tables'] & string,
  TInput extends ReadonlyJSONValue | undefined,
  TOutput extends ReadonlyJSONValue | undefined,
  TReturn = PullRow<TTable>,
  TContext = DefaultContext,
>(query: QueryOrQueryRequest<TTable, TInput, TOutput, DefaultSchema, TReturn, TContext>) {
  return query;
}
