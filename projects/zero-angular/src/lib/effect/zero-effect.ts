import type { AnyQuery, ConnectionState, HumanReadable } from '@rocicorp/zero';
import { Context, Effect, Layer, Stream } from 'effect';

import type { ZeroService } from '../zero.service';

const emptyHumanReadable = <T>(): HumanReadable<T> => [] as unknown as HumanReadable<T>;

// Error type for Zero-related operations
export class ZeroError {
  readonly _tag = 'ZeroError';
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

const query = <TReturn>(queryFn: () => AnyQuery) =>
  Stream.asyncPush<TypeOfStream<TReturn>, ZeroError>((emit) => {
    const init: Effect.Effect<{ typedView: any; remove: () => void } | undefined, ZeroError, any> =
      Effect.gen(function* init($) {
        const zeroService = yield* $(ZeroServiceTag);
        const q = queryFn();
        if (!q) {
          emit.end();
          return undefined;
        }

        const zero = zeroService.zero();
        if (!zero) {
          yield* $(Effect.fail(new ZeroError('Zero not initialized')));
        }

        const typedView = (zero as any).materialize(q);

        // Register listener to push snapshots
        const remove = typedView.addListener(
          (snap: unknown, _resultType: 'unknown' | 'complete' | 'error', error?: unknown) => {
            if (_resultType === 'error') {
              emit.fail(new ZeroError('Query errored', error));
            } else {
              emit.single(snap as TypeOfStream<TReturn>);
            }
          },
        );

        return { remove, typedView };
      });

    return Effect.acquireRelease(init, (_res) =>
      Effect.sync(() => {
        const res = _res as { typedView?: any; remove?: () => void } | undefined;
        if (!res) {
          return;
        }
        try {
          res.remove?.();
        } catch {}
        try {
          res.typedView?.destroy();
        } catch {}
      }),
    );
  });

const connectionState = () =>
  Stream.asyncPush<ConnectionState, ZeroError>((emit) => {
    const init: Effect.Effect<{ remove: () => void } | undefined, ZeroError, any> = Effect.gen(
      function* init($) {
        const zeroService = yield* $(ZeroServiceTag);
        const zero = zeroService.zero();
        if (!zero) {
          yield* $(Effect.fail(new ZeroError('Zero not initialized')));
        }

        const _zeroAny = zero as any;

        const remove =
          typeof _zeroAny.addConnectionListener === 'function'
            ? _zeroAny.addConnectionListener((state: ConnectionState) => {
                emit.single(state);
              })
            : () => {};

        return { remove };
      },
    );

    return Effect.acquireRelease(init, (res) =>
      Effect.sync(() => {
        const r = res as { remove?: () => void } | undefined;
        if (!r) {
          return;
        }
        try {
          r.remove?.();
        } catch {}
      }),
    );
  });

const runQuery = <TReturn>(_queryFn: () => AnyQuery) =>
  Effect.succeed(emptyHumanReadable<TReturn>());
const preload = (_queryFn: () => AnyQuery, _options?: { ttl?: number }) =>
  Effect.succeed({ cleanup: () => {}, complete: Promise.resolve() });
const runWithOptions = <TReturn>(
  _queryFn: () => AnyQuery,
  _runOptions?: { signal?: AbortSignal },
) => Effect.succeed([] as unknown as TReturn);

/**
 * Effect Layer / helpers for providing ZeroService into Effect computations.
 */
export const ZeroServiceTag = Context.GenericTag<'ZeroService', ZeroService>('ZeroService');

export const ZeroServiceLive = (zeroService: ZeroService) =>
  Layer.succeed(ZeroServiceTag, zeroService as any);

export const runWithZero = <Type>(
  effect: Effect.Effect<Type, ZeroError>,
  zeroService: ZeroService,
) => Effect.runPromise(effect.pipe(Effect.provideService(ZeroServiceTag, zeroService)));

export const runStreamWithZero = <Type>(
  stream: Stream.Stream<Type, ZeroError>,
  zeroService: ZeroService,
) =>
  Effect.runPromise(
    Effect.raceFirst(
      Stream.runCollect(stream.pipe(Stream.provideService(ZeroServiceTag, zeroService))),
      Effect.succeed([] as unknown as Type[]),
    ),
  );

export { query, connectionState, runQuery, preload, runWithOptions };

// Helper type inference for Stream items
type TypeOfStream<T> = T extends HumanReadable<infer U> ? HumanReadable<U> : HumanReadable<T>;
