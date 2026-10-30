import { finding, newBasket, tebex, usage } from './lib/tebex';

const specUrl = 'https://raw.githubusercontent.com/tebexio/TebexCheckout-OpenAPI/v1.1.5/checkout-api.yaml';

const [code] = process.argv.slice(2);
if (!code) usage('Usage: pnpm coupons <code of a coupon in your project>');

const apply = async (body: Record<string, string>) => {
  const basket = await newBasket();
  const { status, text } = await tebex('POST', `/baskets/${basket.ident}/coupons`, body);
  return `${JSON.stringify(body)} -> ${status} ${text || '(empty body)'}`;
};

const spec = await (await fetch(specUrl)).text();
finding(
  'Applying a coupon isn\'t documented for the Checkout API',
  'POST /baskets/{ident}/coupons is in the Checkout API docs and spec',
  `checkout-api.yaml v1.1.5 mentions a coupons path: ${spec.includes('/coupons')}`,
);

finding(
  'The route rejects the Headless API\'s body, saying the coupon doesn\'t exist',
  '{"coupon_code": ...} works, as on the Headless API, or a 400 that says the field is missing',
  [
    await apply({ coupon_code: code }),
    await apply({ couponCode: code }),
    await apply({ couponCode: 'NOT-A-REAL-COUPON' }),
  ],
);
