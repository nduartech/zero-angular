import { type Signal, inject } from '@angular/core';
import type {
  CustomMutatorDefs,
  DefaultContext,
  DefaultSchema,
  Zero as ZeroClient,
} from '@rocicorp/zero';

import { ZeroService } from './zero.service';

const injectZero = <
  SchemaType extends DefaultSchema = DefaultSchema,
  MutatorDefs extends CustomMutatorDefs | undefined = undefined,
  ContextType = DefaultContext,
>(): Signal<ZeroClient<SchemaType, MutatorDefs, ContextType> | undefined> => {
  const maybeSvc = inject(ZeroService);
  // `inject` returns unknown at runtime; narrow once to `any` for the return value.
  // This is intentionally conservative: we avoid repeating `as unknown as`.
  const svc = maybeSvc as any as ZeroService<SchemaType, MutatorDefs, ContextType>;
  return svc.zero;
};

export { injectZero };
