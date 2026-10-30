const { TEBEX_PROJECT_ID, TEBEX_PRIVATE_KEY } = process.env;

if (!TEBEX_PROJECT_ID || !TEBEX_PRIVATE_KEY) {
  console.error('Set TEBEX_PROJECT_ID and TEBEX_PRIVATE_KEY in .env (see .env.example).');
  process.exit(1);
}

export const projectId = TEBEX_PROJECT_ID;
export const privateKey = TEBEX_PRIVATE_KEY;

export const headers = {
  Authorization: `Basic ${Buffer.from(`${projectId}:${privateKey}`).toString('base64')}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

export async function tebex(method: string, path: string, body?: unknown) {
  const response = await fetch(`https://checkout.tebex.io/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = (await response.text()).replace(/\s+/g, ' ').trim();
  return { status: response.status, text, json: text ? JSON.parse(text) : null };
}

export async function newBasket(extra: Record<string, unknown> = {}) {
  const { status, json, text } = await tebex('POST', '/baskets', {
    return_url: 'https://example.com/cancel',
    complete_url: 'https://example.com/complete',
    ...extra,
  });
  if (status !== 200) throw new Error(`POST /baskets answered ${status}: ${text}`);
  const added = await tebex('POST', `/baskets/${json.ident}/packages`, {
    package: { name: 'Test guide', price: 29.99, type: 'single' },
    qty: 1,
  });
  if (added.status !== 200) throw new Error(`Adding a package answered ${added.status}: ${added.text}`);
  return json;
}

let count = 0;

export function finding(title: string, expected: string, actual: string | string[]) {
  count += 1;
  const lines = Array.isArray(actual) ? actual : [actual];
  console.log(`\n${count}. ${title}`);
  console.log(`   Expected: ${expected}`);
  lines.forEach((line, index) => console.log(`   ${index === 0 ? 'Actual:  ' : '         '} ${line}`));
}

export function usage(message: string): never {
  console.error(message);
  process.exit(1);
}
