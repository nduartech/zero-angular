import { DestroyRef, type Signal, inject, signal } from '@angular/core';
import type { ConnectionState } from '@rocicorp/zero';

import { injectZero } from './inject-zero';

const injectConnectionState = (): Signal<ConnectionState | undefined> => {
  const zeroSignal = injectZero();

  const initial = zeroSignal()?.connection?.state?.current;
  const state = signal<ConnectionState | undefined>(initial);

  const zeroClient = zeroSignal();
  if (!zeroClient) {
    return state;
  }

  const unsubscribe = zeroClient.connection.state.subscribe((connectionState) => {
    state.set(connectionState);
  });

  const destroyRef = inject(DestroyRef);
  destroyRef.onDestroy?.(() => unsubscribe());

  return state;
};

export { injectConnectionState };
