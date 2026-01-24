import { DestroyRef, type Signal, effect, inject, signal } from '@angular/core';
import type { ConnectionState } from '@rocicorp/zero';

import { injectZero } from './inject-zero';

const injectConnectionState = (): Signal<ConnectionState | undefined> => {
  const zeroSignal = injectZero();

  const state = signal<ConnectionState | undefined>(zeroSignal()?.connection?.state?.current);

  let unsubscribe: (() => void) | undefined;

  effect(
    () => {
      const zeroClient = zeroSignal();

      unsubscribe?.();
      unsubscribe = undefined;

      if (!zeroClient) {
        state.set(undefined);
        return;
      }

      state.set(zeroClient.connection.state.current);
      unsubscribe = zeroClient.connection.state.subscribe((connectionState) => {
        state.set(connectionState);
      });
    },
    { allowSignalWrites: true },
  );

  const destroyRef = inject(DestroyRef);
  destroyRef.onDestroy?.(() => unsubscribe?.());

  return state;
};

export { injectConnectionState };
