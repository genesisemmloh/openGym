import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFoodSearch, cleanQuery, slimHit } from '../food-search.js';

const answer = hits => async () => ({ ok: true, json: async () => ({ hits }) });

test('food search cleans the words and keeps only the fields the app reads', () => {
  assert.equal(cleanQuery('  a '), null);
  assert.equal(cleanQuery(' pollo   asado '), 'pollo asado');
  assert.deepEqual(slimHit({ code: '123', product_name: 'Oats', brands: ['A', 'B'], nutriments: { 'energy-kcal_100g': 389, sugars_100g: 1 }, secret: 'x' }),
    { nutriments: { 'energy-kcal_100g': 389 }, code: '123', product_name: 'Oats', brands: 'A,B' });
});

test('food search caches per words and language, and limits one user', async () => {
  let n = 0;
  const fs = createFoodSearch({ fetchFn: async (...a) => { n++; return answer([{ product_name: 'Rice', nutriments: { 'energy-kcal_100g': 130 } }])(...a); } });
  const a = await fs.search('u1', 'Rice', 'en');
  const b = await fs.search('u1', 'rice', 'en');
  assert.equal(a.status, 200);
  assert.deepEqual(a.body, b.body);
  assert.equal(n, 1);
  assert.equal((await fs.search('u1', 'x', 'en')).status, 400);
  for (let i = 0; i < 25; i++) await fs.search('u2', 'food ' + i, 'en');
  assert.equal((await fs.search('u2', 'one more', 'en')).status, 429);
});

test('food search answers 502 when the service fails', async () => {
  const fs = createFoodSearch({ fetchFn: async () => ({ ok: false, status: 503 }) });
  assert.equal((await fs.search('u', 'oats', 'en')).status, 502);
  const fs2 = createFoodSearch({ fetchFn: async () => { throw new Error('down'); } });
  assert.equal((await fs2.search('u', 'oats', 'en')).status, 502);
});
