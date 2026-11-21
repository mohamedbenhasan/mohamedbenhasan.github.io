import assert from 'node:assert/strict';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import {
  ApiNonJsonResponseError,
  parseStrictJsonResponse,
  resolveApiUrl,
  isNativeMobilePlatform,
} from '../utils/apiClient';
import {
  buildDefaultPendingConsent,
  isOfflineOrNetworkError,
  isValidConsentStatusResponse,
  writeConsentCache,
  CLIENT_CONSENT_VERSION,
  CLIENT_PRIVACY_VERSION,
  CLIENT_TERMS_VERSION,
} from '../services/ConsentService';
import { geolocationService } from '../services/GeolocationService';
import { simulationService } from '../services/SimulationService';

async function runTests() {
  console.log('1) Verifying SimulationService does NOT prematurely request GPS at import/startup...');
  const simState = simulationService.getState();
  assert.ok(simState, 'SimulationState initialized');
  assert.equal((simulationService as any).isGpsMode, false, 'GPS must stay inactive prior to consent/Dashboard mount');

  console.log('2) Verifying parseStrictJsonResponse rejects Capacitor localhost HTML 200 OK instead of returning {} / undefined...');
  const htmlResponse = new Response('<!doctype html><html><body>SPA index</body></html>', {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
  await assert.rejects(
    async () => parseStrictJsonResponse<{ consent: any }>(htmlResponse),
    (err: unknown) => {
      assert.ok(err instanceof ApiNonJsonResponseError, 'Must throw ApiNonJsonResponseError on HTML 200');
      return true;
    }
  );

  console.log('3) Verifying parseStrictJsonResponse parses valid JSON response cleanly...');
  const validConsent = {
    ...buildDefaultPendingConsent('android'),
    consentStatus: 'accepted' as const,
    consentVersion: CLIENT_CONSENT_VERSION,
    termsVersion: CLIENT_TERMS_VERSION,
    privacyVersion: CLIENT_PRIVACY_VERSION,
    acceptedAt: Date.now(),
    accessAllowed: true,
    requiresConsent: false,
    updatedAt: Date.now(),
  };
  const jsonResponse = new Response(JSON.stringify({ accepted: true, consent: validConsent }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
  const parsedJson = await parseStrictJsonResponse<{ accepted: boolean; consent: unknown }>(jsonResponse);
  assert.equal(parsedJson.accepted, true);
  assert.ok(isValidConsentStatusResponse(parsedJson.consent), 'Valid ConsentStatusResponse verified');
  assert.equal((parsedJson.consent as any).accessAllowed, true);

  console.log('4) Verifying isValidConsentStatusResponse rejects undefined, null, {}, and partial objects...');
  assert.equal(isValidConsentStatusResponse(undefined), false);
  assert.equal(isValidConsentStatusResponse(null), false);
  assert.equal(isValidConsentStatusResponse({}), false);
  assert.equal(isValidConsentStatusResponse({ consentStatus: 'accepted' }), false);
  assert.equal(isValidConsentStatusResponse({ accessAllowed: 'true', requiresConsent: false }), false);
  assert.equal(isValidConsentStatusResponse(buildDefaultPendingConsent('android')), true);

  console.log('5) Verifying offline/network error classification...');
  assert.equal(isOfflineOrNetworkError(new Error('Failed to get document because the client is offline.')), true);
  assert.equal(isOfflineOrNetworkError({ code: 'unavailable', message: 'Network unavailable' }), true);
  assert.equal(isOfflineOrNetworkError(new Error('Missing or insufficient permissions.')), false);

  console.log('6) Verifying resolveApiUrl behavior on browser vs Capacitor Android...');
  assert.equal(isNativeMobilePlatform(), false);
  assert.equal(resolveApiUrl('/api/user/accept-consent'), '/api/user/accept-consent');

  const memoryStorage = new Map<string, string>();
  const mockLocalStorage = {
    getItem: (k: string) => memoryStorage.get(k) ?? null,
    setItem: (k: string, v: string) => {
      memoryStorage.set(k, v);
    },
    removeItem: (k: string) => {
      memoryStorage.delete(k);
    },
  };
  (globalThis as any).window = { localStorage: mockLocalStorage };

  const origIsNative = Capacitor.isNativePlatform;
  const origGetPlatform = Capacitor.getPlatform;
  const origCheckPerms = Geolocation.checkPermissions;
  const origReqPerms = Geolocation.requestPermissions;

  const origAppUrl = process.env.APP_URL;
  const origViteApiBase = process.env.VITE_API_BASE_URL;
  try {
    (Capacitor as any).isNativePlatform = () => true;
    (Capacitor as any).getPlatform = () => 'android';

    assert.equal(isNativeMobilePlatform(), true);
    if (origAppUrl) {
      assert.equal(
        resolveApiUrl('/api/user/accept-consent'),
        `${origAppUrl.replace(/\/+$/, '')}/api/user/accept-consent`,
        'Hosted APK build must resolve /api/... to APP_URL rather than localhost'
      );
    }

    delete process.env.APP_URL;
    delete process.env.VITE_API_BASE_URL;
    assert.equal(resolveApiUrl('/api/user/accept-consent'), null, 'Standalone APK without API base must skip localhost relative fetch');
    assert.equal(resolveApiUrl('/api/user/consent-status'), null);
    assert.equal(resolveApiUrl('/api/android-app/latest'), null);

    // Configured HTTPS external backend URL must resolve properly
    mockLocalStorage.setItem('vruguard_api_base_url', 'https://api.vruguard.example.com/');
    assert.equal(
      resolveApiUrl('/api/user/accept-consent'),
      'https://api.vruguard.example.com/api/user/accept-consent'
    );

    // Loopback URL must NEVER be accepted as external Android API URL
    mockLocalStorage.setItem('vruguard_api_base_url', 'https://localhost');
    assert.equal(resolveApiUrl('/api/user/accept-consent'), null);
    mockLocalStorage.removeItem('vruguard_api_base_url');

    console.log('7) Verifying UID-scoped local cache & strict version checks...');
    writeConsentCache('user-android-1', validConsent);
    const storedRaw = mockLocalStorage.getItem('vruguard_consent_cache_user-android-1');
    assert.ok(storedRaw, 'Accepted consent written to UID cache');
    const storedObj = JSON.parse(storedRaw!);
    assert.equal(storedObj.uid, 'user-android-1');
    assert.equal(storedObj.consent.accessAllowed, true);

    // Pending consent clears cache (never caches pending as accepted)
    writeConsentCache('user-android-1', buildDefaultPendingConsent('android'));
    assert.equal(mockLocalStorage.getItem('vruguard_consent_cache_user-android-1'), null);

    // Refused consent keeps accessAllowed: false
    const refusedConsent = {
      ...buildDefaultPendingConsent('android'),
      consentStatus: 'refused' as const,
      refusedAt: Date.now(),
      accessAllowed: false,
      requiresConsent: true,
      updatedAt: Date.now(),
    };
    writeConsentCache('user-android-2', refusedConsent);
    const refusedRaw = JSON.parse(mockLocalStorage.getItem('vruguard_consent_cache_user-android-2')!);
    assert.equal(refusedRaw.consent.accessAllowed, false);
    assert.equal(refusedRaw.consent.requiresConsent, true);

    console.log('8) Verifying GeolocationService Android 12+ coarse, fine, denied, and LOCATION_DISABLED handling...');
    // Case A: Android 12+ grants coarseLocation only
    const coarseRes = await geolocationService.ensureNativePermission({
      checkPermissions: async () => ({ location: 'denied', coarseLocation: 'granted' }),
      requestPermissions: async () => ({ location: 'denied', coarseLocation: 'granted' }),
    });
    assert.equal(coarseRes.granted, true);
    assert.equal(coarseRes.precision, 'coarse');

    // Case B: Prompt -> user grants fine location
    const fineRes = await geolocationService.ensureNativePermission({
      checkPermissions: async () => ({ location: 'prompt', coarseLocation: 'prompt' }),
      requestPermissions: async () => ({ location: 'granted', coarseLocation: 'granted' }),
    });
    assert.equal(fineRes.granted, true);
    assert.equal(fineRes.precision, 'fine');

    // Case C: Permission denied does not throw crash
    const deniedRes = await geolocationService.ensureNativePermission({
      checkPermissions: async () => ({ location: 'denied', coarseLocation: 'denied' }),
      requestPermissions: async () => ({ location: 'denied', coarseLocation: 'denied' }),
    });
    assert.equal(deniedRes.granted, false);
    assert.equal((deniedRes.error as any)?.code, 'PERMISSION_DENIED');

    // Case D: Device GPS disabled (Capacitor v8 OS-PLUG-GLOC-0007) handled cleanly
    const gpsOffRes = await geolocationService.ensureNativePermission({
      checkPermissions: async () => {
        throw Object.assign(new Error('Location services are not enabled'), { code: 'OS-PLUG-GLOC-0007' });
      },
      requestPermissions: async () => ({ location: 'denied', coarseLocation: 'denied' }),
    });
    assert.equal(gpsOffRes.granted, false);
    assert.equal((gpsOffRes.error as any)?.code, 'LOCATION_DISABLED');
  } finally {
    (Capacitor as any).isNativePlatform = origIsNative;
    (Capacitor as any).getPlatform = origGetPlatform;
    (Geolocation as any).checkPermissions = origCheckPerms;
    (Geolocation as any).requestPermissions = origReqPerms;
    delete (globalThis as any).window;
  }

  console.log('✅ All Android consent, JSON strictness, standalone URL routing, offline cache, and Android permission checks passed.');
}

runTests().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
