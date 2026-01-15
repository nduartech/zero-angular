# Zero Angular

Angular integration for Zero by Rocicorp - reactive sync engine with complete feature parity to Zero SolidJS and Svelte libraries.

## Features

- ✅ **Complete API Parity** - Feature-complete with Zero SolidJS and Svelte
- ✅ **Reactive Queries** - Angular signals for live-updating data
- ✅ **Connection State** - Real-time connection monitoring
- ✅ **Query Management** - Update and destroy query subscriptions
- ✅ **Effect TS Integration** - Functional programming with Effect streams
- ✅ **View Deduplication** - Efficient query caching and lifecycle management
- ✅ **Type Safety** - Full TypeScript support with strict generics

## Installation

```bash
npm install zero-angular @rocicorp/zero effect
```

## Setup

### Configure Zero Provider

In your `app.config.ts`:

```typescript
import { provideZero } from 'zero-angular';
import { createSchema, table, string, number } from '@rocicorp/zero';

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

## Promise-based API

### Reactive Queries

```typescript
import { Component } from '@angular/core';
import { injectZero, injectQuery, injectConnectionState } from 'zero-angular';

@Component({
  selector: 'app-users',
  template: `
    @if (connectionState() === 'connected') {
      <div>Connected ✅</div>
    } @else {
      <div>Disconnected ❌</div>
    }

    @for (user of users(); track user.id) {
      <div>{{ user.name }} ({{ user.age }})</div>
    }

    <button (click)="refreshUsers()">Refresh</button>
    <button (click)="cleanup()">Cleanup</button>
  `,
})
export class UsersComponent {
  private zero = injectZero();

  // Reactive query with update/destroy methods
  private query = injectQuery(() => this.zero().query.users);
  users = this.query.data;
  details = this.query.details;

  // Connection state
  connectionState = injectConnectionState();

  // Update query dynamically
  refreshUsers() {
    this.query.updateQuery(() => this.zero().query.users.where('active', true));
  }

  // Cleanup resources
  cleanup() {
    this.query.destroy();
  }
}
```

### Advanced Query Operations

```typescript
import { injectZero, ZeroService } from 'zero-angular';

@Component({...})
export class AdvancedComponent {
  private zero = injectZero();

  async ngOnInit() {
    // Preload data
    const { cleanup, complete } = await this.zero().preload(
      this.zero().query.users.where('active', true),
      { ttl: 30000 }
    );

    await complete; // Wait for preload to complete
    cleanup(); // Clean up preload resources
  }

  async runCustomQuery() {
    // Run query with custom options
    const result = await this.zero().run(
      this.zero().query.users.limit(10),
      { signal: AbortSignal.timeout(5000) }
    );
    console.log('Query result:', result);
  }

  async materializeView() {
    // Direct view access for advanced use cases
    const view = this.zero().materialize(
      this.zero().query.users
    );

    view.addListener((data, resultType) => {
      console.log('View updated:', data, resultType);
    });
  }
}
```

## Effect TS API

For functional programming with Effect streams and proper error handling:

### Streaming Queries

```typescript
import { Component, inject } from '@angular/core';
import { Effect, Stream } from 'effect';
import { ZeroEffect, ZeroServiceLive } from 'zero-angular/effect';
import { ZeroService } from 'zero-angular';

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

```typescript
import { Effect, Stream } from 'effect';
import { ZeroEffect, ZeroServiceLive } from 'zero-angular/effect';

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

```typescript
import { ZeroEffect, ZeroServiceLive } from 'zero-angular/effect';

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

### Advanced Effect Patterns

```typescript
import { Effect, Stream } from 'effect';
import { ZeroEffect, ZeroServiceLive } from 'zero-angular/effect';

// Complex effect combining multiple operations
const complexOperation = Effect.gen(function* () {
  const zeroService = yield* Effect.service(ZeroServiceTag);

  // Run multiple queries in parallel
  const [users, posts] = yield* Effect.all([
    ZeroEffect.runQuery(() => zeroService.zero()!.query.users),
    ZeroEffect.runQuery(() => zeroService.zero()!.query.posts),
  ]);

  // Preload related data
  yield* ZeroEffect.preload(() => zeroService.zero()!.query.comments.where('postId', posts[0]?.id));

  return { users, posts };
});

// Run with service layer
const result = await Effect.runPromise(
  complexOperation.pipe(Effect.provide(ZeroServiceLive(zeroService))),
);
```

## API Reference

### Core Functions

| Function                  | Description                 | Returns                     |
| ------------------------- | --------------------------- | --------------------------- |
| `provideZero(options)`    | Configure Zero provider     | `EnvironmentProviders`      |
| `injectZero()`            | Access Zero instance        | `Signal<Zero \| undefined>` |
| `injectQuery(queryFn)`    | Reactive query subscription | `QueryResult<T>`            |
| `injectConnectionState()` | Connection state monitoring | `Signal<ConnectionState>`   |

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
| `ZeroEffect.query(queryFn)`                    | Streaming query effect  | `Effect<HumanReadable<T>>` |
| `ZeroEffect.connectionState()`                 | Connection state stream | `Effect<ConnectionState>`  |
| `ZeroEffect.runQuery(queryFn)`                 | One-off query execution | `Effect<HumanReadable<T>>` |
| `ZeroEffect.preload(queryFn, options?)`        | Preload data effect     | `Effect<PreloadResult>`    |
| `ZeroEffect.runWithOptions(queryFn, options?)` | Run with custom options | `Effect<T>`                |

### ZeroService Methods

| Method                     | Description        | Returns                                          |
| -------------------------- | ------------------ | ------------------------------------------------ |
| `preload(query, options?)` | Preload query data | `{cleanup: () => void, complete: Promise<void>}` |
| `run(query, runOptions?)`  | Execute query      | `Promise<HumanReadable<T>>`                      |
| `materialize(query)`       | Create view        | `TypedView<HumanReadable<T>>`                    |

## Architecture

### View Management

- **ViewStore**: Deduplicates materialized views by query hash
- **ViewWrapper**: Manages individual view lifecycle and subscriptions
- **Angular Signals**: Reactive state updates without manual subscription management

### Effect Integration

- **Streaming**: Reactive data flows with proper error handling
- **Service Layer**: Dependency injection through Effect's service system
- **Resource Management**: Automatic cleanup of streams and subscriptions

### Type Safety

- **Strict Generics**: Schema-aware query building and result types
- **No `any` Types**: Full type safety throughout the API surface
- **Zero Integration**: Compatible with all Zero client features

## Migration from Other Libraries

### From Zero SolidJS

```typescript
// SolidJS
const [users] = useQuery(() => z.query.users);
const zero = useZero();

// Angular (Promise-based)
const query = injectQuery(() => zero().query.users);
const users = query.data;
const zero = injectZero();

// Angular (Effect-based)
const usersEffect = ZeroEffect.query(() => zero().query.users);
```

### From Zero Svelte

```typescript
// Svelte
const query = z.createQuery(() => z.query.users);
const users = $derived(query.data);

// Angular (Promise-based)
const query = injectQuery(() => zero().query.users);
const users = query.data;

// Angular (Effect-based)
const usersEffect = ZeroEffect.query(() => zero().query.users);
```

## Contributing

This library maintains complete feature parity with Zero SolidJS and Svelte implementations. All new features should be implemented across all three frameworks for consistency.

## License

MIT
