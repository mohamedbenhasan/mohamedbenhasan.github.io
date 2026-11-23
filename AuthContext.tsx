import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  reauthenticateWithPopup,
  EmailAuthProvider,
  reauthenticateWithCredential,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './firebase';
import { presenceService } from './services/presenceService';
import { subscriptionService } from './services/SubscriptionService';
import { incidentService } from './services/IncidentService';
import { tripRoomService } from './services/TripRoomService';
import { V2XService } from './services/V2XService';
import { consentService, isOfflineOrNetworkError, isValidConsentStatusResponse } from './services/ConsentService';
import {
  ApiNonJsonResponseError,
  isBackendUnavailableError,
  markBackendApiUnavailable,
  parseStrictJsonResponse,
  resolveApiUrl,
} from './utils/apiClient';
import { toast } from './services/NotificationService';
import {
  AdminNotificationRecord,
  AdminRole,
  ConsentStatusResponse,
  CurrencySource,
  FeatureKey,
  OptionalConsents,
  PlanRegionalConfig,
  PlatformSettings,
  SubscriptionPlan,
  SupportedCurrency,
  UserSubscription,
} from './types';
import { hasFeatureAccess } from './utils/subscriptionPlans';

const CURRENCY_STORAGE_KEY = 'vruguard_currency_pref';
const CURRENCY_SOURCE_KEY = 'vruguard_currency_source';
const DEFAULT_SUPER_ADMIN_EMAILS = ['medbenhasan@gmail.com', 'medbenhasa@gmail.com'];

export interface PublicPlatformConfig {
  platformName: string;
  logoUrl: string;
  contactEmail: string;
  supportEmail: string;
  planPrices: PlatformSettings['planPrices'];
  regionalPlans?: Record<SubscriptionPlan, PlanRegionalConfig>;
  pioneerProgramEnabled: boolean;
  accessibilityProgramEnabled: boolean;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  announcementEnabled: boolean;
  announcementText: string;
  announcementType: 'info' | 'warning' | 'success';
}

interface AuthContextType {
  user: User | null;
  role: 'ADMIN' | 'OPERATOR' | null;
  serverRole: AdminRole | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  loading: boolean;
  subscription: UserSubscription | null;
  effectivePlan: SubscriptionPlan;
  publicConfig: PublicPlatformConfig | null;
  currency: SupportedCurrency;
  currencySource: CurrencySource;
  detectedCountry: string | null;
  detectedCurrency: SupportedCurrency;
  setCurrency: (nextCurrency: SupportedCurrency) => void;
  resetCurrencyToAuto: () => void;
  refreshPublicConfig: () => Promise<void>;
  accountRestrictionMessage: string | null;
  clearAccountRestriction: () => void;
  hasFeature: (feature: FeatureKey) => boolean;
  refreshSubscription: () => Promise<void>;
  refreshSessionStatus: () => Promise<void>;
  reauthenticateAdmin: (password?: string) => Promise<boolean>;
  upgradePromptFeature: FeatureKey | null;
  openUpgradeModal: (feature: FeatureKey) => void;
  closeUpgradeModal: () => void;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  consentStatus: ConsentStatusResponse | null;
  consentLoading: boolean;
  consentInitialized: boolean;
  refreshConsentStatus: () => Promise<ConsentStatusResponse | null>;
  acceptUserConsent: (payload: {
    acceptedRequired: boolean;
    optionalConsents: OptionalConsents;
  }) => Promise<ConsentStatusResponse>;
  refuseUserConsent: () => Promise<ConsentStatusResponse>;
  updateOptionalConsents: (optionalConsents: Partial<OptionalConsents>) => Promise<ConsentStatusResponse>;
  withdrawUserConsent: () => Promise<ConsentStatusResponse>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  serverRole: null,
  isSuperAdmin: false,
  isAdmin: false,
  loading: true,
  subscription: null,
  effectivePlan: 'FREE',
  publicConfig: null,
  currency: 'EUR',
  currencySource: 'auto',
  detectedCountry: null,
  detectedCurrency: 'EUR',
  setCurrency: () => {},
  resetCurrencyToAuto: () => {},
  refreshPublicConfig: async () => {},
  accountRestrictionMessage: null,
  clearAccountRestriction: () => {},
  hasFeature: () => false,
  refreshSubscription: async () => {},
  refreshSessionStatus: async () => {},
  reauthenticateAdmin: async () => false,
  upgradePromptFeature: null,
  openUpgradeModal: () => {},
  closeUpgradeModal: () => {},
  loginWithGoogle: async () => {},
  loginWithEmail: async () => {},
  signUpWithEmail: async () => {},
  logout: async () => {},
  consentStatus: null,
  consentLoading: true,
  consentInitialized: false,
  refreshConsentStatus: async () => null,
  acceptUserConsent: async () => {
    throw new Error('AuthContext non initialisé');
  },
  refuseUserConsent: async () => {
    throw new Error('AuthContext non initialisé');
  },
  updateOptionalConsents: async () => {
    throw new Error('AuthContext non initialisé');
  },
  withdrawUserConsent: async () => {
    throw new Error('AuthContext non initialisé');
  },
});

export const useAuth = () => useContext(AuthContext);

function readStoredManualCurrency(): { currency: SupportedCurrency; source: CurrencySource } {
  try {
    const src = window.localStorage.getItem(CURRENCY_SOURCE_KEY);
    const cur = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (src === 'manual' && (cur === 'TND' || cur === 'EUR')) {
      return { currency: cur, source: 'manual' };
    }
  } catch {
    // ignore storage failures
  }
  return { currency: 'EUR', source: 'auto' };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const initialCurrencyPref = readStoredManualCurrency();
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'ADMIN' | 'OPERATOR' | null>(null);
  const [serverRole, setServerRole] = useState<AdminRole | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [publicConfig, setPublicConfig] = useState<PublicPlatformConfig | null>(null);
  const [currency, setCurrencyState] = useState<SupportedCurrency>(initialCurrencyPref.currency);
  const [currencySource, setCurrencySource] = useState<CurrencySource>(initialCurrencyPref.source);
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null);
  const [detectedCurrency, setDetectedCurrency] = useState<SupportedCurrency>('EUR');
  const [accountRestrictionMessage, setAccountRestrictionMessage] = useState<string | null>(null);
  const [upgradePromptFeature, setUpgradePromptFeature] = useState<FeatureKey | null>(null);
  const [consentStatus, setConsentStatus] = useState<ConsentStatusResponse | null>(null);
  const [consentLoading, setConsentLoading] = useState<boolean>(false);
  const [consentInitialized, setConsentInitialized] = useState<boolean>(false);

  const displayedNotifIdsRef = useRef<Set<string>>(new Set());

  const applyServerGeo = useCallback((geo?: { country?: string | null; currency?: SupportedCurrency }) => {
    if (!geo) return;
    const serverCurrency: SupportedCurrency = geo.currency === 'TND' ? 'TND' : 'EUR';
    setDetectedCountry(geo.country ?? null);
    setDetectedCurrency(serverCurrency);
    try {
      const savedSource = window.localStorage.getItem(CURRENCY_SOURCE_KEY);
      const savedCurrency = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
      if (savedSource === 'manual' && (savedCurrency === 'TND' || savedCurrency === 'EUR')) {
        setCurrencyState(savedCurrency);
        setCurrencySource('manual');
        return;
      }
    } catch {
      // ignore storage errors
    }
    setCurrencyState(serverCurrency);
    setCurrencySource('auto');
  }, []);

  const setCurrency = useCallback((nextCurrency: SupportedCurrency) => {
    setCurrencyState(nextCurrency);
    setCurrencySource('manual');
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, nextCurrency);
      window.localStorage.setItem(CURRENCY_SOURCE_KEY, 'manual');
    } catch {
      // ignore
    }
  }, []);

  const resetCurrencyToAuto = useCallback(() => {
    setCurrencyState(detectedCurrency);
    setCurrencySource('auto');
    try {
      window.localStorage.removeItem(CURRENCY_STORAGE_KEY);
      window.localStorage.setItem(CURRENCY_SOURCE_KEY, 'auto');
    } catch {
      // ignore
    }
  }, [detectedCurrency]);

  const refreshPublicConfig = useCallback(async () => {
    try {
      const apiUrl = resolveApiUrl('/api/platform/public-config');
      if (!apiUrl) return;
      const resp = await fetch(apiUrl);
      if (resp.status === 404) {
        markBackendApiUnavailable();
        return;
      }
      if (!resp.ok) return;
      const data = await parseStrictJsonResponse<any>(resp);
      if (data?.config) setPublicConfig(data.config);
      if (data?.geo) applyServerGeo(data.geo);
    } catch (err) {
      if (err instanceof ApiNonJsonResponseError || (err as any)?.status === 404) {
        markBackendApiUnavailable();
      }
      // keep existing config cleanly (e.g. offline, static hosting, or standalone Android)
    }
  }, [applyServerGeo]);

  useEffect(() => {
    const unsubSub = subscriptionService.subscribe((sub) => {
      setSubscription(sub);
    });
    const unsubUpgrade = subscriptionService.onUpgradeRequired((feature) => {
      setUpgradePromptFeature(feature);
    });
    return () => {
      unsubSub();
      unsubUpgrade();
    };
  }, []);

  // Load public config & Geo-IP currency immediately (even before login)
  useEffect(() => {
    refreshPublicConfig();
  }, [refreshPublicConfig]);

  const surfaceAdminNotifications = useCallback(
    async (notifications: AdminNotificationRecord[], token: string) => {
      for (const notif of notifications) {
        if (displayedNotifIdsRef.current.has(notif.id)) continue;
        displayedNotifIdsRef.current.add(notif.id);
        const toastFn =
          notif.type === 'success'
            ? toast.success
            : notif.type === 'warning'
            ? toast.warning
            : notif.type === 'error'
            ? toast.error
            : toast.info;
        toastFn(notif.title, {
          id: `adm-${notif.id}`,
          description: notif.message,
        });
        const readUrl = resolveApiUrl(`/api/user/notifications/${encodeURIComponent(notif.id)}/read`);
        if (readUrl) {
          fetch(readUrl, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          }).catch(() => {});
        }
      }
    },
    []
  );

  const applyStaticAdminRoleFallback = useCallback((currentUser: User) => {
    const normalizedEmail = (currentUser.email || '').trim().toLowerCase();
    const isOwnerAdmin =
      Boolean(currentUser.emailVerified) && DEFAULT_SUPER_ADMIN_EMAILS.includes(normalizedEmail);
    setAccountRestrictionMessage(null);
    setServerRole(isOwnerAdmin ? 'SUPER_ADMIN' : 'OPERATOR');
    setIsSuperAdmin(isOwnerAdmin);
    setIsAdmin(isOwnerAdmin);
    setRole(isOwnerAdmin ? 'ADMIN' : 'OPERATOR');
  }, []);

  const syncSessionWithServer = useCallback(
    async (currentUser: User) => {
      try {
        const apiUrl = resolveApiUrl('/api/auth/session-status');
        if (!apiUrl) {
          applyStaticAdminRoleFallback(currentUser);
          return;
        }
        const token = await currentUser.getIdToken();
        const resp = await fetch(apiUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (resp.status === 404) {
          markBackendApiUnavailable();
          applyStaticAdminRoleFallback(currentUser);
          return;
        }
        if (!resp.ok) {
          if (resp.status >= 500 || resp.status === 405) {
            applyStaticAdminRoleFallback(currentUser);
          }
          return;
        }
        const data = await parseStrictJsonResponse<any>(resp);

        if (data.publicConfig) {
          setPublicConfig(data.publicConfig);
        }
        if (data.geo) {
          applyServerGeo(data.geo);
        }

        if (
          data.sessionRevoked ||
          data.accountStatus === 'banned' ||
          data.accountStatus === 'suspended' ||
          data.accountStatus === 'soft_deleted'
        ) {
          const msg =
            data.restrictionReason ||
            (data.sessionRevoked
              ? 'Votre session a été révoquée par l’administration.'
              : 'Votre compte est restreint.');
          setAccountRestrictionMessage(msg);
          toast.error(msg, { id: 'account-restriction' });
          incidentService.unsubscribeAll();
          tripRoomService.unsubscribeAll();
          V2XService.unsubscribeAll();
          await presenceService.stopHeartbeat();
          subscriptionService.clear();
          setIsSuperAdmin(false);
          setIsAdmin(false);
          setServerRole(null);
          setConsentStatus(null);
          setConsentInitialized(false);
          await signOut(auth);
          return;
        }

        setAccountRestrictionMessage(null);
        setServerRole(data.role || 'OPERATOR');
        setIsSuperAdmin(Boolean(data.isSuperAdmin));
        setIsAdmin(Boolean(data.isAdmin));
        setRole(data.isAdmin ? 'ADMIN' : 'OPERATOR');
        if (isValidConsentStatusResponse(data.consent)) {
          setConsentStatus(data.consent);
          setConsentInitialized(true);
        }

        if (Array.isArray(data.unreadNotifications) && data.unreadNotifications.length > 0) {
          surfaceAdminNotifications(data.unreadNotifications, token);
        }
      } catch (err) {
        if (
          err instanceof ApiNonJsonResponseError ||
          isBackendUnavailableError(err) ||
          (err as any)?.status === 404
        ) {
          markBackendApiUnavailable();
          applyStaticAdminRoleFallback(currentUser);
          return;
        }
        console.warn('Session status sync warning:', err);
      }
    },
    [surfaceAdminNotifications, applyServerGeo, applyStaticAdminRoleFallback]
  );

  const refreshSubscription = useCallback(async () => {
    if (!auth.currentUser) return;
    await subscriptionService.fetchMySubscription();
  }, []);

  const refreshSessionStatus = useCallback(async () => {
    if (!auth.currentUser) return;
    await syncSessionWithServer(auth.currentUser);
  }, [syncSessionWithServer]);

  const refreshConsentStatus = useCallback(async (): Promise<ConsentStatusResponse | null> => {
    if (!auth.currentUser) {
      setConsentStatus(null);
      setConsentLoading(false);
      setConsentInitialized(false);
      return null;
    }
    setConsentLoading(true);
    try {
      const next = await consentService.getConsentStatus();
      if (!isValidConsentStatusResponse(next)) {
        throw new Error('Statut de consentement invalide.');
      }
      setConsentStatus(next);
      setConsentInitialized(true);
      return next;
    } catch (err) {
      console.warn('Consent status verification error:', err);
      return null;
    } finally {
      setConsentLoading(false);
    }
  }, []);

  const acceptUserConsent = useCallback(
    async (payload: {
      acceptedRequired: boolean;
      optionalConsents: OptionalConsents;
    }): Promise<ConsentStatusResponse> => {
      const res = await consentService.acceptConsent(payload);
      if (!res || !isValidConsentStatusResponse(res.consent)) {
        throw new Error('Réponse de validation du consentement invalide ou incomplète.');
      }
      setConsentStatus(res.consent);
      setConsentInitialized(true);
      setConsentLoading(false);
      return res.consent;
    },
    []
  );

  const refuseUserConsent = useCallback(async (): Promise<ConsentStatusResponse> => {
    const res = await consentService.refuseConsent();
    if (!res || !isValidConsentStatusResponse(res.consent)) {
      throw new Error('Réponse invalide lors du refus de consentement.');
    }
    setConsentStatus(res.consent);
    setConsentInitialized(true);
    setConsentLoading(false);
    return res.consent;
  }, []);

  const updateOptionalConsents = useCallback(
    async (optionalConsents: Partial<OptionalConsents>): Promise<ConsentStatusResponse> => {
      const next = await consentService.updateOptionalConsents(optionalConsents);
      if (!isValidConsentStatusResponse(next)) {
        throw new Error('Réponse invalide lors de la mise à jour des préférences.');
      }
      setConsentStatus(next);
      setConsentInitialized(true);
      return next;
    },
    []
  );

  const withdrawUserConsent = useCallback(async (): Promise<ConsentStatusResponse> => {
    const next = await consentService.withdrawConsent();
    if (!isValidConsentStatusResponse(next)) {
      throw new Error('Réponse invalide lors du retrait du consentement.');
    }
    setConsentStatus(next);
    setConsentInitialized(true);
    return next;
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setConsentLoading(true);
        setConsentInitialized(false);
        applyStaticAdminRoleFallback(currentUser);
        try {
          const userDocRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef).catch((error) => {
            if (isOfflineOrNetworkError(error)) {
              console.warn('Offline while loading user profile, continuing initialization:', error);
              return null;
            }
            handleFirestoreError(error, OperationType.GET, `users/${currentUser.uid}`);
            throw error;
          });

          if (userDoc && !userDoc.exists()) {
            await setDoc(userDocRef, {
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName || currentUser.email?.split('@')[0],
              displayNameLowercase: (
                currentUser.displayName ||
                currentUser.email?.split('@')[0] ||
                ''
              ).toLowerCase(),
              photoURL: currentUser.photoURL || null,
              role: 'OPERATOR',
              createdAt: serverTimestamp(),
            }).catch((error) => {
              if (isOfflineOrNetworkError(error)) {
                console.warn('Offline while creating user doc:', error);
                return;
              }
              handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
              throw error;
            });

            const publicProfileRef = doc(db, 'public_profiles', currentUser.uid);
            await setDoc(publicProfileRef, {
              uid: currentUser.uid,
              displayName: currentUser.displayName || currentUser.email?.split('@')[0],
              displayNameLowercase: (
                currentUser.displayName ||
                currentUser.email?.split('@')[0] ||
                ''
              ).toLowerCase(),
              photoURL: currentUser.photoURL || null,
              online: true,
              lastActiveAt: serverTimestamp(),
            }).catch((error) => {
              if (isOfflineOrNetworkError(error)) {
                console.warn('Offline while creating public_profile doc:', error);
                return;
              }
              handleFirestoreError(
                error,
                OperationType.WRITE,
                `public_profiles/${currentUser.uid}`
              );
              throw error;
            });
          }

          await syncSessionWithServer(currentUser);
          if (auth.currentUser) {
            try {
              const verifiedConsent = await consentService.getConsentStatus();
              if (isValidConsentStatusResponse(verifiedConsent)) {
                setConsentStatus(verifiedConsent);
              }
            } catch (consentErr) {
              console.warn('Initial consent status check failed:', consentErr);
            } finally {
              setConsentInitialized(true);
              setConsentLoading(false);
            }
            await subscriptionService.fetchMySubscription().catch((subErr) => {
              console.warn('Initial subscription fetch warning:', subErr);
            });
            presenceService.startHeartbeat();
          } else {
            setConsentInitialized(false);
            setConsentLoading(false);
          }
        } catch (error) {
          console.error('Error in AuthContext:', error);
          try {
            if (auth.currentUser) {
              const fallbackConsent = await consentService.getConsentStatus();
              if (isValidConsentStatusResponse(fallbackConsent)) {
                setConsentStatus(fallbackConsent);
              }
            }
          } catch {
            // keep safe state
          } finally {
            setConsentInitialized(true);
            setConsentLoading(false);
          }
        }
      } else {
        incidentService.unsubscribeAll();
        tripRoomService.unsubscribeAll();
        V2XService.unsubscribeAll();
        setRole(null);
        setServerRole(null);
        setIsSuperAdmin(false);
        setIsAdmin(false);
        setConsentStatus(null);
        setConsentLoading(false);
        setConsentInitialized(false);
        subscriptionService.clear();
        await presenceService.stopHeartbeat();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [syncSessionWithServer, applyStaticAdminRoleFallback]);

  // Periodic background session & notification check (every 30s)
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      if (auth.currentUser) {
        syncSessionWithServer(auth.currentUser);
      }
    }, 30_000);
    return () => clearInterval(interval);
  }, [user, syncSessionWithServer]);

  const reauthenticateAdmin = useCallback(async (password?: string): Promise<boolean> => {
    const current = auth.currentUser;
    if (!current) return false;
    try {
      const providerIds = current.providerData.map((p) => p.providerId);
      if (providerIds.includes('password') && password && current.email) {
        const cred = EmailAuthProvider.credential(current.email, password);
        await reauthenticateWithCredential(current, cred);
      } else {
        await reauthenticateWithPopup(current, googleProvider);
      }
      await current.getIdToken(true);
      return true;
    } catch (err) {
      console.error('Reauthentication failed:', err);
      return false;
    }
  }, []);

  const hasFeature = useCallback(
    (feature: FeatureKey): boolean => {
      return hasFeatureAccess(subscription, feature);
    },
    [subscription]
  );

  const openUpgradeModal = useCallback((feature: FeatureKey) => {
    setUpgradePromptFeature(feature);
  }, []);

  const closeUpgradeModal = useCallback(() => {
    setUpgradePromptFeature(null);
  }, []);

  const loginWithGoogle = async () => {
    setAccountRestrictionMessage(null);
    await signInWithPopup(auth, googleProvider);
  };

  const loginWithEmail = async (email: string, password: string) => {
    setAccountRestrictionMessage(null);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    setAccountRestrictionMessage(null);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(userCredential.user, { displayName: name.trim() });
    }
  };

  const logout = async () => {
    try {
      incidentService.unsubscribeAll();
      tripRoomService.unsubscribeAll();
      V2XService.unsubscribeAll();
      await presenceService.stopHeartbeat();
      await signOut(auth);
      subscriptionService.clear();
      setIsSuperAdmin(false);
      setIsAdmin(false);
      setServerRole(null);
      setConsentStatus(null);
      setConsentLoading(false);
      setConsentInitialized(false);
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  const effectivePlan: SubscriptionPlan = subscription?.effectivePlan || 'FREE';

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        serverRole,
        isSuperAdmin,
        isAdmin,
        loading,
        subscription,
        effectivePlan,
        publicConfig,
        currency,
        currencySource,
        detectedCountry,
        detectedCurrency,
        setCurrency,
        resetCurrencyToAuto,
        refreshPublicConfig,
        accountRestrictionMessage,
        clearAccountRestriction: () => setAccountRestrictionMessage(null),
        hasFeature,
        refreshSubscription,
        refreshSessionStatus,
        reauthenticateAdmin,
        upgradePromptFeature,
        openUpgradeModal,
        closeUpgradeModal,
        loginWithGoogle,
        loginWithEmail,
        signUpWithEmail,
        logout,
        consentStatus,
        consentLoading,
        consentInitialized,
        refreshConsentStatus,
        acceptUserConsent,
        refuseUserConsent,
        updateOptionalConsents,
        withdrawUserConsent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
