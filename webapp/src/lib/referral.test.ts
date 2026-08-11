import { describe, it, expect, beforeEach } from 'vitest';
import { captureReferralCode, readReferralCode, clearReferralCode } from './referral';

describe('referral cookie capture (first-touch)', () => {
  beforeEach(() => {
    clearReferralCode();
  });

  it('captures a code when none is set yet', () => {
    captureReferralCode('TRAINERA');
    expect(readReferralCode()).toBe('TRAINERA');
  });

  it('does not overwrite an existing code (first-touch, not last-touch)', () => {
    // A visitor lands via trainer A's link, then later via trainer B's link.
    // Trainer A recruited them first and must keep the attribution.
    captureReferralCode('TRAINERA');
    captureReferralCode('TRAINERB');
    expect(readReferralCode()).toBe('TRAINERA');
  });

  it('reads null when no code has been captured', () => {
    expect(readReferralCode()).toBeNull();
  });

  it('never throws when cookie access is blocked (in-app webviews)', () => {
    // IG/TikTok in-app browsers can throw on document.cookie access. This
    // helper runs in an effect on every route, so a throw would white-screen
    // the whole app. Storage failure must degrade silently.
    const original = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get() { throw new Error('cookies blocked'); },
      set() { throw new Error('cookies blocked'); },
    });
    try {
      expect(() => captureReferralCode('TRAINERA')).not.toThrow();
      expect(() => readReferralCode()).not.toThrow();
      expect(readReferralCode()).toBeNull();
    } finally {
      if (original) Object.defineProperty(document, 'cookie', original);
    }
  });
});
