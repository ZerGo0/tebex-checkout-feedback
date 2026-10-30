# Tebex Checkout API feedback

We're [Journey](https://getjourney.gg). We're moving our checkout from Stripe to the Tebex Checkout API and launch on November 4, 2026.

This is what we ran into, with proof and what we'd expect instead. Everything was checked on October 30, 2026 against our test-mode project, the latest spec ([checkout-api.yaml v1.1.5](https://github.com/tebexio/TebexCheckout-OpenAPI/blob/v1.1.5/checkout-api.yaml)) and the latest published Node SDK ([`@tebexio/tebex-sdk-nodejs` 1.0.0](https://www.npmjs.com/package/@tebexio/tebex-sdk-nodejs)). Every point can be reproduced with the scripts below.

## How we use it

- Our API runs on Cloudflare Workers.
- For each purchase we create a basket, add one package and, if the buyer used a creator code on our site, add a sale. Then we send the buyer to `links.checkout`.
- Webhooks tell us when a payment completes, is declined, refunded or disputed. We read it with `GET /payments/{txnId}?type=txn_id`.
- When the buyer comes back before the webhook, we read the basket's `payment` to find the transaction.
- We started with your spec, but ended up writing [our own](journey/checkout-api.yaml) from real responses and generating a client from it.

## Coupons

We'd like to replace the basket sale with a real coupon per creator, so buyers can also type the code on Tebex's checkout.

**1. Applying a coupon isn't documented for the Checkout API.** It's only documented for the Headless API, as [`POST /accounts/{token}/baskets/{basketIdent}/coupons`](https://docs.tebex.io/developers/headless-api/endpoints). The Checkout API has `POST /baskets/{ident}/coupons` too, and it's what your checkout page calls, but it isn't in the Checkout API docs, spec or SDK.

**2. That route rejects the Headless API's body and says the coupon doesn't exist.** We only found `couponCode` by watching the checkout page's requests.

```text
{"coupon_code":"TEST10A"} -> 400 {"message": "No coupon exists with that code."}
{"couponCode":"TEST10A"} -> 200 (empty body)
{"couponCode":"NOT-A-REAL-COUPON"} -> 404 {"message": "No coupon exists with that code."}
```

Expected: `{"coupon_code": ...}` works, as on the Headless API, or at least a 400 that says the field is missing.

**3. Creating coupons needs a second API.** The Checkout API can't create coupons. We can make them in the panel or through the Plugin API (`POST https://plugin.tebex.io/coupons`), which needs a separate `X-Tebex-Secret` key. Expected: coupon creation in the Checkout API, so one key and one spec cover it.

## Spec

We generated a client from `checkout-api.yaml` v1.1.5 with [Orval](https://orval.dev), with response validation on, and called our test project with it.

**1. Creating a basket fails validation.** Fields the spec says are always a boolean, number, array or string come back as `null`:

```text
priceDetails.recurring: expected boolean, received null
tax: expected number, received null
discounts: expected array, received null
address.name, first_name, last_name, address, email, postal_code: expected string, received null
payment: expected object, received null
```

Expected: those fields are marked `nullable` in the spec.

**2. Reading a paid basket fails validation.** `payment` and `priceDetails.tax` have different shapes than in the spec:

```text
priceDetails.tax: expected number, received object
payment.status: expected object, received string

payment returned: {"txnId":"tbx-54730126a32117-814176","status":"complete","amount":27.03,"currency":"USD"}
priceDetails.tax returned: {"name":"VAT","taxAmount":2.03,"taxableAmount":25}
```

Expected: the spec describes the `payment` object a basket actually returns. It isn't a `Payment` (`transaction_id`, `status.id`, `price.amount`). This is also why the SDK loses the payment (SDK point 3).

**3. `email_immutable` works, but isn't documented.** Sending `"email_immutable": true` to `POST /baskets` locks the email on the checkout page. We use it for signed-in buyers. Expected: it's in the docs and spec.

**4. A package without a price or type is a server error.**

```text
500 {"message": "Server Error"}
```

Expected: a 400 with `field_details`, like other invalid requests.

**5. Errors come in different shapes, and the spec describes none of them.** The spec has an `ErrorResponse`, but no response uses it.

```text
invalid sale: 400 {"status":400,"type":"about:blank","title":"Invalid request","detail":"...","error_code":"CLIENT_VALIDATION_FAILURE","field_details":{...},"meta":[]}
unknown basket: 404 {"message": ""}
refunding a refunded payment: 422 {"error": "You can only refund payments that have a status of completed."}
```

Expected: one error format, used by every error response in the spec.

## Node SDK

We tried it as any user would, from npm. 1.0.0 (January 2025) is the only published version. Its Checkout client is generated from spec 1.1.2.

**1. It doesn't install with pnpm's default settings.** Its runtime dependencies are build tools, one of them straight from GitHub:

```json
{
  "jest": "^29.7.0",
  "openapitools": "github:openapitools/openapi-generator-cli",
  "@cypress/request": "^3.0.7",
  "@openapitools/openapi-generator-cli": "^2.15.3"
}
```

```text
$ pnpm add @tebexio/tebex-sdk-nodejs
Failed to resolve dependency tree: Exotic dependency "openapitools" (resolved via git-repository)
is not allowed in subdependencies when blockExoticSubdeps is enabled
```

With npm it installs, at 99 MB of `node_modules`. The README's `npm install tebexio/tebex-sdk-nodejs` installs from GitHub without the built files, so it can't be loaded at all. Expected: `@cypress/request` as the only runtime dependency.

**2. The package exports nothing.** `require("@tebexio/tebex-sdk-nodejs")` returns `{}`, and the README doesn't show an import. It works with `require("@tebexio/tebex-sdk-nodejs/dist/tebex")`. Expected: the entry point exports `Tebex`.

**3. There are no TypeScript types.** In a strict TypeScript project:

```text
error TS7016: Could not find a declaration file for module '@tebexio/tebex-sdk-nodejs/dist/tebex.js'.
```

Expected: the package ships `.d.ts` files.

**4. A paid basket loses its payment.** `checkout.getBasket(...)` returns `payment: {"status": {}}`, while the API returned `{"txnId": "tbx-54730126a32117-814176", "status": "complete", "amount": 27.03, ...}`. Expected: the transaction is there.

**5. `email_immutable` can't be sent.** `createBasket({ emailImmutable: true, email_immutable: true, ... })` makes a basket with `"email_immutable": false`. Expected: the basket locks the email.

**6. There's no way to apply a coupon.** Expected: a method for `POST /baskets/{ident}/coupons`.

**7. The HTTP client is hard-coded.** `dist/tebex-request.js` has `const request = require('@cypress/request');`, and nothing lets you pass in `fetch` or another client. Expected: a way to pass one in.

## Reproduce it

You need Node 22 or newer, [pnpm](https://pnpm.io) and a Checkout API project in test mode with at least one paid test basket.

```sh
cp .env.example .env   # add your project ID and private key
pnpm install
```

Each command prints its points as Expected and Actual. The commands create baskets but never pay for them.

### `pnpm spec <paid basket ident> [<tbx- ID of a refunded payment>]`

Checks Spec points 1 to 5. It generates a client from `checkout-api.yaml` v1.1.5 with Orval (into `generated/`, with response validation on), then:

1. Creates a basket through it.
2. Reads your paid basket through it.
3. Creates a basket with `"email_immutable": true`.
4. Adds a package without a price or type.
5. Sends an invalid sale and reads a basket that doesn't exist. If you pass a refunded payment, it also tries to refund it again, which changes nothing.

### `pnpm coupons <code of a coupon in your project>`

Checks Coupons points 1 and 2:

1. Checks whether `checkout-api.yaml` v1.1.5 has a coupons path.
2. Applies the code to a new basket with `coupon_code`, to another with `couponCode`, and applies a made-up code to a third.

Point 3 isn't scripted. Coupon creation is documented in the [Plugin API](https://docs.tebex.io/plugin/endpoints/coupons#create-a-coupon).

### `pnpm sdk <paid basket ident>`

Checks Node SDK points 2 to 7, printed as 1 to 6:

1. Requires the package's entry point.
2. Type-checks a one-line import of the SDK with `tsc --strict`.
3. Reads your paid basket through the SDK and through the API.
4. Creates a basket through the SDK with `emailImmutable` and `email_immutable` set to `true`.
5. Lists the SDK's Checkout methods with "coupon" in the name.
6. Prints the line in `dist/tebex-request.js` that loads the HTTP client.

Point 1 isn't scripted. Run `pnpm add @tebexio/tebex-sdk-nodejs` in an empty folder to see it. This repo's `pnpm-workspace.yaml` allows the SDK's GitHub dependency and skips its build scripts, so it installs here.
