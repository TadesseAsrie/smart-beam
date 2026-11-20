import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { RoomStore } from '../src/rooms';

function start(extra: Record<string, string> = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-'));
  const cfg = loadConfig({ DATA_DIR: dir, RECEIVER_DIR: path.resolve(__dirname, '../../receiver'), ...extra } as NodeJS.ProcessEnv);
  const ctx = createApp(cfg);
  const server = ctx.app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { ...ctx, server, base, dir, close: () => { ctx.stop(); server.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

const pdfBytes = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF');
const form = (name: string, data: Buffer, extra: Record<string, string> = {}) => {
  const f = new FormData();
  f.append('file', new Blob([data]), name);
  for (const [k, v] of Object.entries(extra)) f.append(k, v);
  return f;
};

test('health endpoint', async () => {
  const s = start();
  const r = await fetch(s.base + '/health');
  assert.equal((await r.json()).ok, true);
  s.close();
});

test('upload, serve, delete a PDF', async () => {
  const s = start();
  const up = await fetch(s.base + '/api/content', { method: 'POST', body: form('deck.pdf', pdfBytes) });
  assert.equal(up.status, 201);
  const j = await up.json();
  const got = await fetch(j.url);
  assert.equal(got.status, 200);
  assert.equal(got.headers.get('content-type'), 'application/pdf');
  const del = await fetch(`${s.base}/api/content/${j.id}`, { method: 'DELETE' });
  assert.equal((await del.json()).deleted, true);
  assert.equal((await fetch(j.url)).status, 404);
  s.close();
});

test('rejects disallowed or disguised files', async () => {
  const s = start();
  assert.equal((await fetch(s.base + '/api/content', { method: 'POST', body: form('run.exe', Buffer.from('MZ')) })).status, 415);
  assert.equal((await fetch(s.base + '/api/content', { method: 'POST', body: form('fake.pdf', Buffer.from('not a pdf at all')) })).status, 415);
  s.close();
});

test('API key is enforced when configured', async () => {
  const s = start({ API_KEY: 'secret-key' });
  assert.equal((await fetch(s.base + '/api/content', { method: 'POST', body: form('a.pdf', pdfBytes) })).status, 401);
  const ok = await fetch(s.base + '/api/content', { method: 'POST', body: form('a.pdf', pdfBytes), headers: { 'x-smartbeam-key': 'secret-key' } });
  assert.equal(ok.status, 201);
  s.close();
});

test('expired content is swept', async () => {
  const s = start({ CONTENT_TTL_MINUTES: '0' });
  const j = await (await fetch(s.base + '/api/content', { method: 'POST', body: form('a.pdf', pdfBytes) })).json();
  await new Promise((r) => setTimeout(r, 20));
  s.sweep();
  assert.equal((await fetch(j.url)).status, 404);
  s.close();
});

test('room lifecycle: online only while receiver polls, key required to write', async () => {
  const store = new RoomStore();
  const r = store.create();
  assert.equal(store.info(r.id)?.online, true);
  assert.equal(store.patch(r.id, 'wrong-key-wrong-key', { page: 3 }), false);
  const pending = store.poll(r.id, r.receiverToken, 1, 2000);
  assert.equal(store.patch(r.id, r.key, { content: { kind: 'pdf', url: 'https://x/y.pdf', title: 'y' }, page: 2 }), true);
  const res = await pending;
  assert.equal(res?.changed, true);
  assert.equal(res?.state.page, 2);
  assert.equal(await store.poll(r.id, 'bad-token', 0, 10), null);
});
