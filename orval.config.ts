import { defineConfig } from 'orval';

export default defineConfig({
  tebex: {
    input: {
      target: 'https://raw.githubusercontent.com/tebexio/TebexCheckout-OpenAPI/v1.1.5/checkout-api.yaml',
    },
    output: {
      target: './generated/client.ts',
      schemas: { path: './generated/model', type: 'zod' },
      client: 'fetch',
      mode: 'split',
      clean: true,
      baseUrl: 'https://checkout.tebex.io/api',
      override: {
        fetch: {
          forceSuccessResponse: true,
          runtimeValidation: true,
        },
      },
    },
  },
});
