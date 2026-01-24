import type { AnyQuery, ConnectionState, HumanReadable, TTL } from '@rocicorp/zero';
import { Context, Effect, Layer, Stream } from 'effect';

export type ZeroServiceLike = {
  zero: () => {
    materialize: (q: AnyQuery) => {
      addListener: (
        cb: (snap: unknown, resultType: 'unknown' | 'complete' | 'error', error?: unknown) => void,
      ) => () => void;
      destroy: () => void;
      updateTTL?: (ttl: TTL) => void;
    };
    connection: {
      state: {
        current: ConnectionState;
        subscribe: (cb: (state: ConnectionState) => void) => () => void;
      };
    };
  } | undefined;
  run: (q: AnyQuery, runOptions?: unknown) => Promise<HumanReadable<unknown>>;
  preload: (q: AnyQuery, options?: { ttl?: TTL }) => PreloadResult;
};

export type PreloadResult = { cleanup: () => void; complete: Promise<void> };

export class ZeroError {
  readonly _tag = 'ZeroError';
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {}
}

type TypeOfStream<T> = T extends HumanReadable<infer U> ? HumanReadable<U> : HumanReadable<T>;

export const ZeroServiceTag = Context.GenericTag<'ZeroService', ZeroServiceLike>('ZeroService');

export const ZeroServiceLive = (zeroService: ZeroServiceLike) =>
  Layer.succeed(ZeroServiceTag, zeroService);

export const query = <TReturn>(queryFn: () => AnyQuery) =>
  Stream.unwrapScoped(
    Effect.gen(function* queryStream($) {
      const zeroService = yield* $(ZeroServiceTag);

      return Stream.asyncPush<TypeOfStream<TReturn>, ZeroError>((emit) => {
        const init = Effect.try({
          try: () => {
            const q = queryFn();
            if (!q) {
              emit.end();
              return undefined;
            }

            const zero = zeroService.zero();
            if (!zero) {
              throw new ZeroError('Zero not initialized');
            }

            const typedView = zero.materialize(q);
            const remove = typedView.addListener((snap, resultType, error) => {
              if (resultType === 'error') {
                emit.fail(new ZeroError('Query errored', error));
                return;
              }
              emit.single(snap as TypeOfStream<TReturn>);
            });

            return { remove, typedView };
          },
          catch: (cause) => (cause instanceof ZeroError ? cause : new ZeroError('Query stream init failed', cause)),
        });

        return Effect.acquireRelease(init, (res) =>
          Effect.sync(() => {
            const r = res as { typedView?: { destroy: () => void }; remove?: () => void } | undefined;
            try {
              r?.remove?.();
            } catch {}
            try {
              r?.typedView?.destroy();
            } catch {}
          }),
        );
      });
    }),
  );

export const connectionState = () =>
  Stream.unwrapScoped(
    Effect.gen(function* connStream($) {
      const zeroService = yield* $(ZeroServiceTag);

      return Stream.asyncPush<ConnectionState, ZeroError>((emit) => {
        const init = Effect.try({
          try: () => {
            const zero = zeroService.zero();
            if (!zero) {
              throw new ZeroError('Zero not initialized');
            }

            const remove = zero.connection.state.subscribe((state) => emit.single(state));
            return { remove };
          },
          catch: (cause) =>
            cause instanceof ZeroError ? cause : new ZeroError('Connection stream init failed', cause),
        });

        return Effect.acquireRelease(init, (res) =>
          Effect.sync(() => {
            const r = res as { remove?: () => void } | undefined;
            try {
              r?.remove?.();
            } catch {}
          }),
        );
      });
    }),
  );

export const runQuery = <TReturn>(queryFn: () => AnyQuery) =>
  Effect.gen(function* runQuery($) {
    const zeroService = yield* $(ZeroServiceTag);
    const zero = zeroService.zero();
    if (!zero) {
      return yield* $(Effect.fail(new ZeroError('Zero not initialized')));
    }

    const q = queryFn();
    try {
      return (yield* $(Effect.promise(() => zeroService.run(q, undefined)))) as HumanReadable<TReturn>;
    } catch (cause) {
      return yield* $(Effect.fail(new ZeroError('Query failed', cause)));
    }
  });

export const preload = (queryFn: () => AnyQuery, options?: { ttl?: TTL }) =>
  Effect.gen(function* preload($) {
    const zeroService = yield* $(ZeroServiceTag);
    const q = queryFn();
    try {
      return zeroService.preload(q, options);
    } catch (cause) {
      return yield* $(Effect.fail(new ZeroError('Preload failed', cause)));
    }
  });

export const runWithOptions = <TReturn>(queryFn: () => AnyQuery, runOptions?: unknown) =>
  Effect.gen(function* runWithOptions($) {
    const zeroService = yield* $(ZeroServiceTag);
    const q = queryFn();
    try {
      return (yield* $(Effect.promise(() => zeroService.run(q, runOptions)))) as HumanReadable<TReturn>;
    } catch (cause) {
      return yield* $(Effect.fail(new ZeroError('Query failed', cause)));
    }
  });

export const runWithZero = <Type>(effect: Effect.Effect<Type, ZeroError>, zeroService: ZeroServiceLike) =>
  Effect.runPromise(effect.pipe(Effect.provideService(ZeroServiceTag, zeroService)));

export const runStreamWithZero = <Type>(
  stream: Stream.Stream<Type, ZeroError>,
  zeroService: ZeroServiceLike,
) => Effect.runPromise(Stream.runCollect(stream.pipe(Stream.provideService(ZeroServiceTag, zeroService))));

export const ZeroEffect = {
  query,
  connectionState,
  runQuery,
  preload,
  runWithOptions,
} as const;
