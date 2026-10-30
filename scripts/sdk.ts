import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { finding, projectId, privateKey, tebex, usage } from './lib/tebex';

const require = createRequire(import.meta.url);

const [paidBasketIdent] = process.argv.slice(2);
if (!paidBasketIdent) usage('Usage: pnpm sdk <ident of a paid basket>');

console.log('Uses @tebexio/tebex-sdk-nodejs 1.0.0 from npm.');

finding(
  2,  'The package exports nothing',
  'require("@tebexio/tebex-sdk-nodejs") returns { Tebex }',
  `require("@tebexio/tebex-sdk-nodejs") returns ${JSON.stringify(require('@tebexio/tebex-sdk-nodejs'))}`,
);

const tsc = spawnSync(
  'tsc',
  ['scripts/fixtures/sdk-import.ts', '--strict', '--noEmit', '--module', 'nodenext', '--moduleResolution', 'nodenext'],
  { encoding: 'utf8', shell: true },
);
finding(
  3,  'There are no TypeScript types',
  'importing the SDK in a strict TypeScript project type-checks',
  tsc.stdout.split('\n')[0].replace(/'\/[^']*node_modules\//, "'node_modules/"),
);

const { Tebex } = require('@tebexio/tebex-sdk-nodejs/dist/tebex');
const checkout = Tebex.checkout.setApiKeys(projectId, privateKey);

const sdkBasket = await checkout.getBasket(paidBasketIdent);
const { txnId, status, amount } = (await tebex('GET', `/baskets/${paidBasketIdent}`)).json.payment;
finding(
  4,  'A paid basket loses its payment',
  `basket.payment has the transaction (the API returns ${JSON.stringify({ txnId, status, amount })})`,
  `checkout.getBasket(...).payment is ${JSON.stringify(sdkBasket.payment)}`,
);

const { body: created } = await checkout.basketsApi.createBasket({
  email: 'buyer@example.com',
  emailImmutable: true,
  email_immutable: true,
  returnUrl: 'https://example.com/cancel',
  completeUrl: 'https://example.com/complete',
});
const lockedEmail = (await tebex('GET', `/baskets/${created.ident}`)).json.email_immutable;
finding(
  5,  "email_immutable can't be sent",
  'the basket locks the email',
  `createBasket({ emailImmutable: true, email_immutable: true, ... }) made a basket with "email_immutable": ${lockedEmail}`,
);

const couponMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(checkout)).filter((method) =>
  /coupon/i.test(method),
);
finding(
  6,  "There's no way to apply a coupon",
  'a Checkout method for POST /baskets/{ident}/coupons',
  `Checkout methods with "coupon" in the name: ${couponMethods.length === 0 ? 'none' : couponMethods.join(', ')}`,
);

const requestFile = readFileSync(require.resolve('@tebexio/tebex-sdk-nodejs/dist/tebex-request'), 'utf8');
finding(
  7,  'The HTTP client is hard-coded',
  'a way to pass in fetch or another client',
  `dist/tebex-request.js: ${requestFile.split('\n').find((line) => line.includes('require('))}`,
);
