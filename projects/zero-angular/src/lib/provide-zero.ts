import { makeEnvironmentProviders } from '@angular/core';
import type { CustomMutatorDefs, DefaultContext, DefaultSchema } from '@rocicorp/zero';

import type { ZeroProviderOptions } from './types';
import { ZeroService } from './zero.service';

const provideZero = <
  SchemaType extends DefaultSchema = DefaultSchema,
  MutatorDefs extends CustomMutatorDefs | undefined = undefined,
  ContextType = DefaultContext,
>(
  _options: ZeroProviderOptions<SchemaType, MutatorDefs, ContextType>,
) => {
  // Provide the service and configure it at app bootstrap time.
  const providers = [ZeroService];

  // Delay calling provide until the service is instantiated; the consumer should
  // Set the options by calling ZeroService.provide() in a top-level initializer
  // Or via APP_INITIALIZER if desired. For convenience we return providers.

  return makeEnvironmentProviders(providers);
};

export { provideZero };
