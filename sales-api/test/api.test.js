import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

// API integration tests require a running server + DB
// These test the endpoint contracts when run against a live instance
// Skip in CI when no DATABASE_URL is set

const API_BASE = process.env.API_BASE || 'http://localhost:3001';

const canRun = !!process.env.DATABASE_URL;
const describeIf = canRun ? describe : describe.skip;

describeIf('API integration tests', () => {
  it('GET /api/rep/kinga/today returns valid shape', async () => {
    const res = await fetch(`${API_BASE}/api/rep/kinga/today`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('items');
    expect(data).toHaveProperty('data_as_of');
    expect(data).toHaveProperty('is_today');
    expect(Array.isArray(data.items)).toBe(true);
  });

  it('GET /api/rep/invalid-rep/today returns 404', async () => {
    const res = await fetch(`${API_BASE}/api/rep/invalid-rep/today`);
    expect(res.status).toBe(404);
  });

  it('GET /api/admin/rules-preview requires rep_id', async () => {
    const res = await fetch(`${API_BASE}/api/admin/rules-preview`);
    expect(res.status).toBe(400);
  });

  it('GET /api/admin/rules-preview with valid rep_id returns dry-run', async () => {
    const res = await fetch(`${API_BASE}/api/admin/rules-preview?rep_id=kinga`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('finalists');
    expect(data).toHaveProperty('debug');
    expect(data.debug.dry_run).toBe(true);
  });

  it('GET /api/admin/validation-gate returns 200 even if empty', async () => {
    const res = await fetch(`${API_BASE}/api/admin/validation-gate`);
    expect(res.status).toBe(200);
  });

  it('POST /internal/compute-daily-actions computes for single rep', async () => {
    const res = await fetch(`${API_BASE}/internal/compute-daily-actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rep_id: 'kinga' }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty('kinga');
  });
});
