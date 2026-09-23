import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SQL = readFileSync(
  resolve(__dirname, '../../migrations/20260923202525_client_location_admin.sql'),
  'utf8',
);

const CLIENT_DETAIL = SQL.slice(
  SQL.indexOf('CREATE OR REPLACE FUNCTION public.get_admin_client_detail'),
  SQL.indexOf('-- Latest live get_admin_user_list definition'),
);

const USER_LIST = SQL.slice(
  SQL.indexOf('CREATE OR REPLACE FUNCTION public.get_admin_user_list'),
  SQL.indexOf('-- Preserve the authenticated admin RPC surface'),
);

describe('client location/admin migration contract', () => {
  it('keeps location nullable and guards profile writes with a pinned trigger function', () => {
    expect(SQL).toMatch(/ALTER TABLE public\.profiles\s+ADD COLUMN IF NOT EXISTS location text;/i);
    expect(SQL).toMatch(/CREATE OR REPLACE FUNCTION public\.validate_client_location\(\)/i);
    expect(SQL).toMatch(/SECURITY DEFINER\s+SET search_path = public, pg_temp/i);
    expect(SQL).toMatch(/regexp_replace\(NEW\.location, '\^\[\[:space:\]\]\+\|\[\[:space:\]\]\+\$', '', 'g'\)/i);
    expect(SQL).toContain("(v_new_role = 'client' OR v_old_role = 'client')");
    expect(SQL).toMatch(/char_length\(NEW\.location\)\s*>\s*100/i);
    expect(SQL).toMatch(/BEFORE INSERT OR UPDATE ON public\.profiles/i);
    expect(SQL).toMatch(/EXECUTE FUNCTION public\.validate_client_location\(\)/i);
    expect(SQL).not.toMatch(/ALTER TABLE public\.profiles[\s\S]*ALTER COLUMN location SET NOT NULL/i);
    expect(SQL).not.toMatch(/UPDATE public\.profiles[\s\S]*\bSET\s+location\s*=/i);
    expect(SQL).not.toContain('BTRIM(NEW.location)');
  });

  it('specifies whitespace-class trimming for blank tabs and newlines', () => {
    const trimBoundaryWhitespace = (value: string) =>
      value.replace(/^[\s]+|[\s]+$/g, '');

    for (const value of ['\t', '\n', '\r\n', '\t\n']) {
      expect(trimBoundaryWhitespace(value)).toBe('');
    }
    expect(trimBoundaryWhitespace('\tChicago\n')).toBe('Chicago');
    expect(SQL).toContain("'^[[:space:]]+|[[:space:]]+$'");
  });

  it('distinguishes completion/location transitions from historic missing-location edits', () => {
    expect(SQL).toContain('v_old_is_completed_client');
    expect(SQL).toContain('v_location_changed := OLD.location IS DISTINCT FROM NEW.location;');
    expect(SQL).toContain('v_old_role IS DISTINCT FROM \'client\'');
    expect(SQL).toContain('NOT v_old_onboarding_complete');
    expect(SQL).toContain('v_new_is_completed_client');
  });

  it('exposes only the requested non-medical client profile fields in detail', () => {
    expect(CLIENT_DETAIL).toContain('NULLIF(p.location, \'\') AS location');
    expect(CLIENT_DETAIL).toContain('p.onboarding_complete');
    expect(CLIENT_DETAIL).toContain('LEFT JOIN public.client_profiles cp ON cp.user_id = p.id');
    for (const field of ['cp.bio', 'cp.fitness_level', 'cp.training_frequency', 'cp.fitness_goals', 'cp.workout_types']) {
      expect(CLIENT_DETAIL).toContain(field);
    }
    expect(CLIENT_DETAIL).toContain('COALESCE(ppd.phone, p.phone) AS phone');
    expect(CLIENT_DETAIL).toContain("IF v_role IS DISTINCT FROM 'admin'");
    expect(CLIENT_DETAIL).not.toMatch(/health_notes|health_conditions|intensity_preference|goals_ranked/i);
  });

  it('adds role-appropriate location to the admin user list and preserves private phone joins', () => {
    expect(USER_LIST).toContain('tp.location');
    expect(USER_LIST).toContain('p.location');
    expect(USER_LIST).toMatch(/END\s+AS location/i);
    expect(USER_LIST).toContain('COALESCE(ppd.phone, tpd.phone, p.phone) AS phone');
    expect(USER_LIST).toContain('LEFT JOIN public.profile_private_details ppd ON ppd.user_id = p.id');
    expect(USER_LIST).toContain('LEFT JOIN public.trainer_private_details tpd ON tpd.user_id = p.id');
    expect(USER_LIST).toContain("IF v_role IS DISTINCT FROM 'admin'");
  });

  it('keeps both admin RPCs authenticated-only', () => {
    expect(SQL).toContain('REVOKE ALL ON FUNCTION public.get_admin_client_detail(uuid) FROM PUBLIC, anon;');
    expect(SQL).toContain('GRANT EXECUTE ON FUNCTION public.get_admin_client_detail(uuid) TO authenticated, service_role;');
    expect(SQL).toContain('REVOKE ALL ON FUNCTION public.get_admin_user_list() FROM PUBLIC, anon;');
    expect(SQL).toContain('GRANT EXECUTE ON FUNCTION public.get_admin_user_list() TO authenticated, service_role;');
  });
});
