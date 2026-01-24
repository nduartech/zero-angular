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
  const svc = inject(ZeroService) as ZeroService<SchemaType, MutatorDefs, ContextType>;
  return svc.zero;
};

export { injectZero };
