import fs from 'fs';
import path from 'path';
import assert from 'assert';
import {
  CURRENT_CONSENT_VERSION,
  CURRENT_PRIVACY_VERSION,
  CURRENT_TERMS_VERSION,
  subscriptionStore,
} from '../server/subscriptionStore';

async function runTests() {
  const dataDir = path.resolve(process.cwd(), '.data');
  const dbPath = path.join(dataDir, 'subscriptions.json');
  const originalDbExists = fs.existsSync(dbPath);
  const originalDbRaw = originalDbExists ? fs.readFileSync(dbPath, 'utf8') : null;

  try {
    console.log('1) Testing New User (pending -> mandatory gate)...');
    const newUid = `test_consent_new_${Date.now()}`;
    subscriptionStore.upsertDirectoryUser({
      uid: newUid,
      email: `${newUid}@example.com`,
      displayName: 'Nouvel Utilisateur',
      emailVerified: true,
    });
    const newUserStatus = subscriptionStore.getUserConsentStatus(newUid);
    assert.strictEqual(newUserStatus.consentStatus, 'pending');
    assert.strictEqual(newUserStatus.accessAllowed, false);
    assert.strictEqual(newUserStatus.requiresConsent, true);

    console.log('2) Testing Acceptance Validation (must reject unchecked required consent)...');
    assert.throws(() => {
      subscriptionStore.acceptUserConsent({
        uid: newUid,
        email: `${newUid}@example.com`,
        platform: 'web',
        acceptedRequired: false,
        optionalConsents: { notifications: true, locationEnhancements: false },
      });
    }, /accepter explicitement/);

    const stillPending = subscriptionStore.getUserConsentStatus(newUid);
    assert.strictEqual(stillPending.accessAllowed, false);

    console.log('3) Testing Valid Web Acceptance & Proof Persistence...');
    const acceptedWeb = subscriptionStore.acceptUserConsent({
      uid: newUid,
      email: `${newUid}@example.com`,
      platform: 'web',
      acceptedRequired: true,
      optionalConsents: { notifications: true, locationEnhancements: false },
      ip: '127.0.0.1',
    });
    assert.strictEqual(acceptedWeb.alreadyAccepted, false);
    assert.strictEqual(acceptedWeb.statusResponse.consentStatus, 'accepted');
    assert.strictEqual(acceptedWeb.statusResponse.accessAllowed, true);
    assert.strictEqual(acceptedWeb.statusResponse.requiresConsent, false);
    assert.strictEqual(acceptedWeb.statusResponse.platform, 'web');
    assert.strictEqual(acceptedWeb.statusResponse.consentVersion, CURRENT_CONSENT_VERSION);
    assert.strictEqual(acceptedWeb.statusResponse.termsVersion, CURRENT_TERMS_VERSION);
    assert.strictEqual(acceptedWeb.statusResponse.privacyVersion, CURRENT_PRIVACY_VERSION);
    assert.strictEqual(acceptedWeb.statusResponse.optionalConsents.notifications, true);
    assert.strictEqual(acceptedWeb.statusResponse.optionalConsents.locationEnhancements, false);
    assert.ok(acceptedWeb.record.acceptedAt && acceptedWeb.record.acceptedAt > 0);
    const originalAcceptedAt = acceptedWeb.record.acceptedAt;

    console.log('4) Testing Re-login on Web & Web -> Android Cross-Platform Sync (same uid)...');
    const reloginStatus = subscriptionStore.getUserConsentStatus(newUid);
    assert.strictEqual(reloginStatus.accessAllowed, true);
    assert.strictEqual(reloginStatus.requiresConsent, false);
    assert.strictEqual(reloginStatus.acceptedAt, originalAcceptedAt);

    console.log('5) Testing Android-first Acceptance & Android -> Web Sync...');
    const androidUid = `test_consent_android_${Date.now()}`;
    subscriptionStore.upsertDirectoryUser({
      uid: androidUid,
      email: `${androidUid}@example.com`,
      displayName: 'Mobile VRU User',
      emailVerified: true,
    });
    const acceptedAndroid = subscriptionStore.acceptUserConsent({
      uid: androidUid,
      email: `${androidUid}@example.com`,
      platform: 'android',
      acceptedRequired: true,
      optionalConsents: { notifications: false, locationEnhancements: true },
      ip: '10.0.2.15',
    });
    assert.strictEqual(acceptedAndroid.statusResponse.platform, 'android');
    assert.strictEqual(acceptedAndroid.statusResponse.accessAllowed, true);

    // Subsequent login from Web / different browser / different device inspects backend by UID
    const webAfterAndroid = subscriptionStore.getUserConsentStatus(androidUid);
    assert.strictEqual(webAfterAndroid.accessAllowed, true);
    assert.strictEqual(webAfterAndroid.requiresConsent, false);
    assert.strictEqual(webAfterAndroid.platform, 'android');

    console.log('6) Testing Concurrent / Simultaneous Double Acceptance Idempotency...');
    const concurrentUid = `test_consent_conc_${Date.now()}`;
    subscriptionStore.upsertDirectoryUser({
      uid: concurrentUid,
      email: `${concurrentUid}@example.com`,
      emailVerified: true,
    });
    const [r1, r2] = await Promise.all([
      Promise.resolve().then(() =>
        subscriptionStore.acceptUserConsent({
          uid: concurrentUid,
          email: `${concurrentUid}@example.com`,
          platform: 'web',
          acceptedRequired: true,
          optionalConsents: { notifications: true, locationEnhancements: true },
        })
      ),
      Promise.resolve().then(() =>
        subscriptionStore.acceptUserConsent({
          uid: concurrentUid,
          email: `${concurrentUid}@example.com`,
          platform: 'android',
          acceptedRequired: true,
          optionalConsents: { notifications: false, locationEnhancements: false },
        })
      ),
    ]);
    assert.strictEqual(r1.alreadyAccepted, false);
    assert.strictEqual(r2.alreadyAccepted, true);
    assert.strictEqual(r1.record.acceptedAt, r2.record.acceptedAt);
    assert.strictEqual(r2.record.history.length, 1);

    console.log('7) Testing Refusal Flow & Immutability of Accepted Consent...');
    const refuseUid = `test_consent_refuse_${Date.now()}`;
    subscriptionStore.upsertDirectoryUser({
      uid: refuseUid,
      email: `${refuseUid}@example.com`,
      emailVerified: true,
    });
    const refused = subscriptionStore.refuseUserConsent({
      uid: refuseUid,
      email: `${refuseUid}@example.com`,
      platform: 'web',
      ip: '127.0.0.1',
    });
    assert.strictEqual(refused.consentStatus, 'refused');
    assert.strictEqual(refused.accessAllowed, false);
    assert.strictEqual(refused.requiresConsent, true);
    assert.strictEqual(refused.acceptedAt, null);

    // Accepted user cannot overwrite acceptance via refuse endpoint
    assert.throws(() => {
      subscriptionStore.refuseUserConsent({
        uid: newUid,
        email: `${newUid}@example.com`,
        platform: 'web',
      });
    }, /rétractation RGPD/);

    console.log('8) Testing Pre-existing Legacy User Without Consent Record (must NOT auto-accept)...');
    const legacyUid = `test_legacy_preexisting_${Date.now()}`;
    subscriptionStore.upsertDirectoryUser({
      uid: legacyUid,
      email: `${legacyUid}@example.com`,
      emailVerified: true,
      createdAt: Date.UTC(2024, 5, 1),
    });
    const legacyConsent = subscriptionStore.getUserConsentStatus(legacyUid);
    assert.strictEqual(legacyConsent.consentStatus, 'pending');
    assert.strictEqual(legacyConsent.accessAllowed, false);
    assert.strictEqual(legacyConsent.requiresConsent, true);

    console.log('9) Testing Optional Consent Updates & RGPD Withdrawal...');
    const updatedPref = subscriptionStore.updateOptionalConsents({
      uid: newUid,
      email: `${newUid}@example.com`,
      platform: 'android',
      optionalConsents: { notifications: false, locationEnhancements: true },
    });
    assert.strictEqual(updatedPref.accessAllowed, true);
    assert.strictEqual(updatedPref.acceptedAt, originalAcceptedAt);
    assert.strictEqual(updatedPref.optionalConsents.notifications, false);
    assert.strictEqual(updatedPref.optionalConsents.locationEnhancements, true);

    const withdrawn = subscriptionStore.withdrawUserConsent({
      uid: newUid,
      email: `${newUid}@example.com`,
      platform: 'web',
    });
    assert.strictEqual(withdrawn.consentStatus, 'withdrawn');
    assert.strictEqual(withdrawn.accessAllowed, false);
    assert.strictEqual(withdrawn.requiresConsent, true);
    // Original acceptedAt historical timestamp preserved
    assert.strictEqual(withdrawn.acceptedAt, originalAcceptedAt);

    console.log('10) Testing Super Admin Read-Only Consent Overview & RBAC Matrix...');
    const adminOverview = subscriptionStore.getAdminConsentsOverview();
    assert.ok(adminOverview.stats.totalUsers >= 5);
    assert.ok(adminOverview.stats.acceptedCount >= 2);
    assert.ok(adminOverview.stats.refusedCount >= 1);
    assert.ok(adminOverview.stats.withdrawnCount >= 1);
    assert.ok(adminOverview.stats.pendingCount >= 1);

    const settings = subscriptionStore.getPlatformSettings();
    const adminPerms = settings.securitySettings.permissionMatrix.ADMIN || [];
    const superPerms = settings.securitySettings.permissionMatrix.SUPER_ADMIN || [];
    assert.ok(adminPerms.includes('consent:read'));
    assert.ok(superPerms.includes('consent:read'));
    assert.strictEqual(adminPerms.includes('consent:write'), false);
    assert.strictEqual(superPerms.includes('consent:write'), false);

    console.log('11) Testing Live HTTP Server Endpoints Auth & Guarding on Port 3000...');
    const baseUrl = 'http://127.0.0.1:3000';
    const health = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(health.status, 200);

    for (const [method, endpoint] of [
      ['GET', '/api/user/consent-status'],
      ['POST', '/api/user/accept-consent'],
      ['POST', '/api/user/refuse-consent'],
      ['PATCH', '/api/user/consent-preferences'],
      ['POST', '/api/user/withdraw-consent'],
      ['GET', '/api/super-admin/consents'],
      ['GET', `/api/super-admin/consents/${newUid}`],
      ['POST', '/api/sos/authorize'],
    ]) {
      const resp = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: method === 'GET' ? undefined : JSON.stringify({}),
      });
      assert.strictEqual(
        resp.status,
        401,
        `Expected HTTP 401 for unauthenticated ${method} ${endpoint}, got ${resp.status}`
      );
    }

    console.log('✅ All 11 First Login Consent & RGPD verification suites passed.');
  } finally {
    if (originalDbExists && originalDbRaw !== null) {
      fs.writeFileSync(dbPath, originalDbRaw, 'utf8');
    } else if (!originalDbExists && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
