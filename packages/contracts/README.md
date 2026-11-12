# @alekstar79/ykassa-contracts

Shared TypeScript types, Zod schemas, UI enums, defaults, and accent palette for the YooKassa MCP integrator.

## Install

```sh
npm install @alekstar79/ykassa-contracts
```

## Validate a client config

```ts
import { ClientConfigSchema } from '@alekstar79/ykassa-contracts/schema';

const result = ClientConfigSchema.safeParse(config);
```

The package also exposes `types`, `palette`, `defaults`, and `scenarios` subpaths.
