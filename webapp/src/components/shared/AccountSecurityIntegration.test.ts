import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const SETTINGS_SURFACES = [
  '../../components/trainer/SettingsTab.tsx',
  '../../components/client/ClientSettingsTab.tsx',
  '../../pages/AdminDashboard.tsx',
];

describe('shared account security integration', () => {
  it.each(SETTINGS_SURFACES)('uses AccountSecuritySection in %s', (relativePath) => {
    const source = readFileSync(resolve(__dirname, relativePath), 'utf8');

    expect(source).toContain("import AccountSecuritySection from '@/components/shared/AccountSecuritySection'");
    expect(source).toContain('<AccountSecuritySection');
  });

  it('keeps the recovery page on the shared password policy', () => {
    const source = readFileSync(resolve(__dirname, '../../pages/ResetPassword.tsx'), 'utf8');

    expect(source).toContain("from '@/lib/passwordPolicy'");
    expect(source).toContain('minLength={PASSWORD_MIN_LENGTH}');
    expect(source).not.toContain('minLength={6}');
  });
});
