import { isPlatformBrowser } from '@angular/common';
import { ENVIRONMENT_INITIALIZER, PLATFORM_ID, inject, makeEnvironmentProviders } from '@angular/core';
import type { CustomMutatorDefs, DefaultContext, DefaultSchema } from '@rocicorp/zero';

import type { ZeroProviderOptions } from './types';
import { ZeroService } from './zero.service';

const provideZero = <
  SchemaType extends DefaultSchema = DefaultSchema,
  MutatorDefs extends CustomMutatorDefs | undefined = undefined,
  ContextType = DefaultContext,
>(
  options: ZeroProviderOptions<SchemaType, MutatorDefs, ContextType>,
) => {
  return makeEnvironmentProviders([
    ZeroService,
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        const platformId = inject(PLATFORM_ID);
        const svc = inject(ZeroService) as ZeroService<SchemaType, MutatorDefs, ContextType>;

        // If the consumer passed a pre-created client, allow it anywhere.
        if ('zero' in options) {
          svc.provide(options);
          return;
        }

        // Constructing a Zero client is browser-only by default.
        if (!isPlatformBrowser(platformId)) {
          return;
        }

        svc.provide(options);
      },
    },
  ]);
};

export { provideZero };
