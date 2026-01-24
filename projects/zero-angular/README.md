# Zero Angular

Angular integration utilities for Zero by Rocicorp.

This package is published as `@nathanld/zero-angular`.

## Installation

```bash
npm install @nathanld/zero-angular @rocicorp/zero
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

## Contributing

- Please keep the published import paths stable.

## License

MIT
