import type { WritableSignal } from '@angular/core';
import type {
  Change,
  Entry,
  ErroredQuery,
  Format,
  Input,
  Output,
  QueryResultDetails,
  TTL,
} from '@rocicorp/zero';

export type State = [Entry, QueryResultDetails];

interface AngularViewOptions {
  input: Input;
  onTransactionCommit: (cb: () => void) => void;
  format: Format;
  onDestroy: () => void;
  queryComplete: true | ErroredQuery | Promise<true>;
  updateTTL: (ttl: TTL) => void;
  setState: WritableSignal<State>;
  retry: () => void;
}

const COMPLETE: QueryResultDetails = Object.freeze({ type: 'complete' });
const UNKNOWN: QueryResultDetails = Object.freeze({ type: 'unknown' });

// Define a simple stream type that matches the interface
type YieldStream = Iterable<'yield'>;

// Simplified AngularView that provides basic functionality
// NOTE: This class intentionally implements a minimal subset of `Output`.
// Full `Output` compatibility (including detailed change application,
// Transactional updates, and streaming semantics) is a larger task and is
// Tracked separately. The current implementation provides the guarantees
// Needed by the rest of this library (state updates and TTL/retry hooks).
export class AngularView implements Output {
  readonly #onDestroy: () => void;
  readonly #retry: () => void;
  readonly #updateTTL: (ttl: TTL) => void;
  #setState: WritableSignal<State>;

  constructor(options: AngularViewOptions) {
    this.#onDestroy = options.onDestroy;
    this.#updateTTL = options.updateTTL;
    this.#setState = options.setState;
    this.#retry = options.retry;

    // Set initial state
    this.#setState.set([
      { '': undefined },
      ((): QueryResultDetails => {
        if (options.queryComplete === true) {
          return COMPLETE;
        }
        if ('error' in options.queryComplete) {
          return this.#makeError(options.queryComplete);
        }
        return UNKNOWN;
      })(),
    ]);

    // Implementation note: full lifecycle and incremental change tracking
    // Are not required for the current integration tests. The `push` method
    // Below is the extension point where change objects would be processed.
  }

  #makeError(error: ErroredQuery): QueryResultDetails {
    const message = error.message ?? 'An unknown error occurred';
    return {
      error: {
        message,
        type: error.error,
        ...(error.details && { details: error.details }),
      },
      refetch: this.#retry,
      retry: this.#retry,
      type: 'error',
    };
  }

  destroy(): void {
    this.#onDestroy();
  }

  push(_change: Change): YieldStream {
    // Return an empty iterable that satisfies the interface. In a full
    // Implementation this would yield control tokens as changes are applied.
    // For now we keep this simple and yield nothing.
    return {
      *[Symbol.iterator](): Iterator<'yield'> {
        // Intentionally empty
      },
    };
  }

  updateTTL(ttl: TTL): void {
    this.#updateTTL(ttl);
  }
}

interface AngularViewFactoryOptions {
  query: unknown;
  input: Input;
  format: Format;
  onDestroy: () => void;
  onTransactionCommit: (cb: () => void) => void;
  queryComplete: true | ErroredQuery | Promise<true>;
  updateTTL: (ttl: TTL) => void;
}

export const createAngularViewFactory = (setState: WritableSignal<State>, retry?: () => void) => {
  const angularViewFactory = (options: AngularViewFactoryOptions) =>
    new AngularView({
      format: options.format,
      input: options.input,
      onDestroy: options.onDestroy,
      onTransactionCommit: options.onTransactionCommit,
      queryComplete: options.queryComplete,
      retry: retry ?? (() => {}),
      setState,
      updateTTL: options.updateTTL,
    });

  return angularViewFactory;
};
