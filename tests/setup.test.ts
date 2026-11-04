import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JS module without types
import { findUuid, setDatabase, setTomlString } from '../scripts/setup.mjs';

const toml = readFileSync('wrangler.toml', 'utf8');

describe('setup script config editing', () => {
  it('adds the database id and fills vars without touching other names', () => {
    let out = setDatabase(toml, 'my-chess', '11111111-2222-3333-4444-555555555555');
    out = setTomlString(out, 'ADMIN_EMAILS', 'a@b.c,d@e.f');
    out = setTomlString(out, 'GOOGLE_CLIENT_ID', 'x.apps.googleusercontent.com');
    expect(out).toMatch(/database_name = "my-chess"\ndatabase_id = "11111111-2222-3333-4444-555555555555"/);
    expect(out).toContain('ADMIN_EMAILS = "a@b.c,d@e.f"');
    expect(out).toContain('GOOGLE_CLIENT_ID = "x.apps.googleusercontent.com"');
    expect(out).toContain('name = "ROOMS"');
    // Running again replaces instead of duplicating.
    const again = setDatabase(out, 'my-chess', '99999999-2222-3333-4444-555555555555');
    expect(again.match(/database_id/g)).toHaveLength(1);
  });

  it('reads the id from "wrangler d1 create" output', () => {
    const sample = `✅ Successfully created DB 'ban-co'\n\n[[d1_databases]]\nbinding = "DB"\ndatabase_name = "ban-co"\ndatabase_id = "8f2c1a9e-5b3d-4e7f-9a1b-2c3d4e5f6a7b"`;
    expect(findUuid(sample)).toBe('8f2c1a9e-5b3d-4e7f-9a1b-2c3d4e5f6a7b');
  });
});
