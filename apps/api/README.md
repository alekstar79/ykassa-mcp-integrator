# @alekstar79/ykassa-api

Headless Express API for the YooKassa MCP integrator. It exposes the payment-agent routes and can also be embedded in another Node.js application.

## Install

```sh
npm install @alekstar79/ykassa-api
```

## Create an Express app

```ts
import { createApp } from '@alekstar79/ykassa-api';

const app = createApp({
  clientsDir: './clients',
  mcpUrl: 'https://mcp.yookassa.ru',
});

app.listen(3000);
```

`createApp()` does not load environment files or open a port. Use the `@alekstar79/ykassa-api/server` entry point to run the bundled server.
