# Zero Angular

Angular integration utilities for Zero by Rocicorp.

This package is published as `@nathanld/zero-angular`.

## Installation

```bash
npm install @nathanld/zero-angular @rocicorp/zero
```

Optional Effect integration:

```bash
npm install effect
```

## Setup

In your `app.config.ts`:

```ts
import { provideZero } from '@nathanld/zero-angular';
import { createSchema, number, string, table } from '@rocicorp/zero';

const schema = createSchema({
  tables: [
    table('users').columns({ id: string(), name: string(), age: number() }).primaryKey('id'),
  ],
});

export const appConfig = {
  providers: [
    provideZero({
      cacheURL: 'https://your-zero-server.com',
      schema,
      userID: 'user-123',
    }),
  ],
};
```

## Core API

```ts
import { injectConnectionState, injectQuery, injectZero } from '@nathanld/zero-angular';

const zero = injectZero();
const connectionState = injectConnectionState();

const usersQuery = injectQuery(() => zero()?.query.users);
const users = usersQuery.data;
const details = usersQuery.details;
```

`injectQuery` supports an optional dedupe key:

```ts
const usersQuery = injectQuery(() => zero()?.query.users, { key: 'users' });
```

### Advanced Query Operations

```typescript
import { injectZero, ZeroService } from '@nathanld/zero-angular';

@Component({...})
export class AdvancedComponent {
  private zero = injectZero();

  async ngOnInit() {
    const z = this.zero();
    if (!z) return;

    // Preload data (returns synchronously)
    const { cleanup, complete } = z.preload(
      z.query.users.where('active', true),
      { ttl: 30000 }
    );

    await complete; // Wait for preload to complete
    cleanup(); // Clean up preload resources
  }

  async runCustomQuery() {
    const z = this.zero();
    if (!z) return;

    // Run query with custom options
    const result = await z.run(
      z.query.users.limit(10),
      { signal: AbortSignal.timeout(5000) }
    );
    console.log('Query result:', result);
  }

  async materializeView() {
    const z = this.zero();
    if (!z) return;

    // Direct view access for advanced use cases
    const view = z.materialize(z.query.users);

    view.addListener((data, resultType) => {
      console.log('View updated:', data, resultType);
    });
  }
}
```

## Effect API (`@nathanld/zero-angular/effect`)

### Streaming Queries

```ts
import { Component, inject } from '@angular/core';
import { Effect, Stream } from 'effect';
import { ZeroEffect, ZeroServiceLive } from '@nathanld/zero-angular/effect';
import { ZeroService } from '@nathanld/zero-angular';

@Component({...})
export class EffectComponent {
  private zeroService = inject(ZeroService);

  async ngOnInit() {
    // Streaming query that emits on changes
    const queryStream = ZeroEffect.query(() =>
      this.zeroService.zero()!.query.users.where('active', true)
    );

    // Collect first 5 updates from the stream
    const updates = await Effect.runPromise(
      Stream.take(queryStream, 5).pipe(
        Stream.runCollect,
        Effect.provide(ZeroServiceLive(this.zeroService))
      )
    );

    console.log('Stream updates:', updates);
  }
}
```

### Connection State Streaming

```ts
import { Effect, Stream } from 'effect';
import { ZeroEffect, ZeroServiceLive } from '@nathanld/zero-angular/effect';

async function monitorConnection(zeroService: ZeroService) {
  const connectionStream = ZeroEffect.connectionState();

  // Stream connection state changes
  const states = await Effect.runPromise(
    Stream.take(connectionStream, 10).pipe(
      Stream.runCollect,
      Effect.provide(ZeroServiceLive(zeroService)),
    ),
  );

  return states; // Array of ConnectionState objects
}
```

### One-off Queries

```ts
import { Effect } from 'effect';
import { ZeroEffect, ZeroServiceLive } from '@nathanld/zero-angular/effect';

async function fetchUser(zeroService: ZeroService, userId: string) {
  const userQuery = ZeroEffect.runQuery(() => zeroService.zero()!.query.users.where('id', userId));

  try {
    const user = await Effect.runPromise(
      userQuery.pipe(Effect.provide(ZeroServiceLive(zeroService))),
    );
    return user[0]; // First result
  } catch (error) {
    console.error('Query failed:', error);
    throw error;
  }
}
```

## API Reference

### Core Functions

| Function                  | Description                 | Returns                        |
| ------------------------- | --------------------------- | ------------------------------ |
| `provideZero(options)`    | Configure Zero provider     | `EnvironmentProviders`         |
| `injectZero()`            | Access Zero instance        | `Signal<Zero \| undefined>`    |
| `injectQuery(queryFn)`    | Reactive query subscription | `QueryResult<T>`               |
| `injectConnectionState()` | Connection state monitoring | `Signal<ConnectionState \| undefined>` |

### QueryResult Interface

```typescript
interface QueryResult<T> {
  readonly data: Signal<HumanReadable<T> | undefined>;
  readonly details: Signal<QueryResultDetails>;
  updateQuery(newQuery: AnyQuery, enabled?: boolean): void;
  destroy(): void;
}
```

### Effect TS Functions

| Function                                       | Description             | Returns                    |
| ---------------------------------------------- | ----------------------- | -------------------------- |
| `ZeroEffect.query(queryFn)`                    | Streaming query stream  | `Stream<HumanReadable<T>>` |
| `ZeroEffect.connectionState()`                 | Connection state stream | `Stream<ConnectionState>`  |
| `ZeroEffect.runQuery(queryFn)`                 | One-off query execution | `Effect<HumanReadable<T>>` |
| `ZeroEffect.preload(queryFn, options?)`        | Preload data effect     | `Effect<PreloadResult>`    |
| `ZeroEffect.runWithOptions(queryFn, options?)` | Run with run options    | `Effect<HumanReadable<T>>` |

### ZeroService Methods

| Method                     | Description        | Returns                                          |
| -------------------------- | ------------------ | ------------------------------------------------ |
| `preload(query, options?)` | Preload query data | `{cleanup: () => void, complete: Promise<void>}` |
| `run(query, runOptions?)`  | Execute query      | `Promise<HumanReadable<T>>`                      |
| `materialize(query)`       | Create view        | `TypedView<HumanReadable<T>>`                    |

## Contributing

- Please keep the published import paths stable.
- Add/adjust tests when changing the Effect entrypoint.

## License

MIT
