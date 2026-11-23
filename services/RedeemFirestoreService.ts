import {
  Timestamp,
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from '../firebase';
import {
  ActivationRecord,
  AdminOverviewStats,
  BillingCycle,
  BusinessQuoteRequest,
  RedeemCodeRecord,
  RedeemCodeStatus,
  RedeemCodeUsageEntry,
  RedeemDurationCode,
  SubscriptionPlan,
  UserSubscription,
} from '../types';
import {
  buildRedeemCsvContent,
  generateRandomRedeemCode,
  hashRedeemCodeClient,
  maskRedeemCodeClient,
  normalizeRedeemCode,
  resolveBillingCycleForDuration,
} from '../utils/redeemCodeUtils';
import { resolveDurationDaysForRedeem, resolveEffectiveSubscription } from '../utils/subscriptionPlans';

const DAY_MS = 24 * 60 * 60 * 1000;

function toMs(val: any): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (val && typeof val.toMillis === 'function') return val.toMillis();
  if (val instanceof Date) return val.getTime();
  return null;
}

function isPermissionDeniedError(err: unknown): boolean {
  const code = String((err as any)?.code || '').toLowerCase();
  const msg = String(err instanceof Error ? err.message : err || '').toLowerCase();
  return code === 'permission-denied' || msg.includes('missing or insufficient permissions');
}

function createIdSuffix(bytesCount = 4): string {
  const bytes = new Uint8Array(bytesCount);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function buildRedeemOverviewStats(
  codes: RedeemCodeRecord[],
  subscriptions: UserSubscription[] = []
): AdminOverviewStats {
  const now = Date.now();
  const effectiveStatus = (c: RedeemCodeRecord): RedeemCodeStatus => {
    if (c.status === 'available' && c.expiresAt && c.expiresAt <= now) return 'expired';
    return c.status;
  };
  return {
    totalRecordedSubscriptions: subscriptions.length,
    freeUsers: subscriptions.filter((s) => s.effectivePlan === 'FREE').length,
    premiumUsers: subscriptions.filter((s) => s.effectivePlan === 'PREMIUM').length,
    familyUsers: subscriptions.filter((s) => s.effectivePlan === 'FAMILY').length,
    businessUsers: subscriptions.filter((s) => s.effectivePlan === 'BUSINESS').length,
    earlyTesterUsers: subscriptions.filter((s) => s.isEarlyTester).length,
    lifetimeUsers: subscriptions.filter((s) => Boolean(s.isLifetime)).length,
    suspendedSubscriptions: subscriptions.filter((s) => s.status === 'suspended').length,
    expiredSubscriptions: subscriptions.filter((s) => s.status === 'expired').length,
    totalCodes: codes.length,
    usedCodes: codes.filter((c) => effectiveStatus(c) === 'used').length,
    availableCodes: codes.filter((c) => effectiveStatus(c) === 'available').length,
    revokedCodes: codes.filter((c) => effectiveStatus(c) === 'revoked').length,
    expiredCodes: codes.filter((c) => effectiveStatus(c) === 'expired').length,
    disabledCodes: codes.filter((c) => effectiveStatus(c) === 'disabled').length,
  };
}

function sanitizeStoredRedeemDoc(
  docId: string,
  raw: Record<string, any>,
  claimsByHash: Map<string, RedeemCodeUsageEntry[]>
): RedeemCodeRecord {
  const now = Date.now();
  const codeHash = typeof raw.codeHash === 'string' && raw.codeHash.length === 64 ? raw.codeHash : docId;
  const masked = raw.maskedCode || raw.code || 'VRU-••••';
  const expiresAt = toMs(raw.expiresAt);
  let status: RedeemCodeStatus = (raw.status as RedeemCodeStatus) || 'available';
  if (status === 'available' && expiresAt !== null && expiresAt <= now) {
    status = 'expired';
  }
  const usageHistory = (claimsByHash.get(codeHash) || []).slice().sort((a, b) => b.usedAt - a.usedAt);
  const latestClaim = usageHistory[0];

  return {
    id: raw.id || codeHash,
    code: masked,
    maskedCode: masked,
    codeHash,
    plan: (raw.plan as RedeemCodeRecord['plan']) || 'PREMIUM',
    billingCycle: (raw.billingCycle as BillingCycle) || 'monthly',
    durationCode: (raw.durationCode as RedeemDurationCode) || '1m',
    durationDays: typeof raw.durationDays === 'number' ? raw.durationDays : null,
    isLifetime: Boolean(raw.isLifetime),
    maxUses: typeof raw.maxUses === 'number' ? raw.maxUses : 1,
    usesCount: typeof raw.usesCount === 'number' ? raw.usesCount : usageHistory.length,
    expiresAt,
    status,
    createdAt: toMs(raw.createdAt) ?? now,
    createdBy: String(raw.createdBy || 'admin'),
    campaign: raw.campaign ?? undefined,
    note: raw.note ?? undefined,
    usedByUid: latestClaim?.uid ?? raw.usedByUid ?? null,
    usedByEmail: latestClaim?.email ?? raw.usedByEmail ?? null,
    usedAt: latestClaim?.usedAt ?? toMs(raw.usedAt),
    usageHistory,
  };
}

function mapFirestoreSubscriptionDoc(
  uid: string,
  subData: Record<string, any>
): UserSubscription {
  return resolveEffectiveSubscription({
    uid,
    email: subData.email ?? null,
    plan: (subData.basePlan || subData.plan || 'FREE') as SubscriptionPlan,
    status: (subData.status || 'active') as any,
    billingCycle: (subData.billingCycle || 'monthly') as BillingCycle,
    startDate: toMs(subData.startDate) ?? Date.now(),
    endDate: toMs(subData.endDate),
    isLifetime: Boolean(
      subData.isLifetime || (subData.endDate === null && subData.plan && subData.plan !== 'FREE')
    ),
    cancelAtPeriodEnd: Boolean(subData.cancelAtPeriodEnd),
    isEarlyTester: Boolean(subData.isEarlyTester),
    earlyTesterStartDate: toMs(subData.earlyTesterStartDate),
    earlyTesterEndDate: toMs(subData.earlyTesterEndDate),
    isAccessibilityLifetime:
      subData.paymentProvider === 'accessibility' || Boolean(subData.isAccessibilityLifetime),
    activationSource: subData.activationSource,
    paymentProvider: subData.paymentProvider ?? null,
    paymentVerified: Boolean(subData.paymentVerified),
    lastPaymentRef: subData.lastPaymentRef ?? null,
    updatedAt: toMs(subData.updatedAt) ?? Date.now(),
  });
}

export const redeemFirestoreService = {
  async redeemCodeInFirestore(params: {
    uid: string;
    email?: string | null;
    code: string;
    expectedPlan?: 'PREMIUM' | 'FAMILY' | 'BUSINESS';
  }): Promise<{
    subscription: UserSubscription;
    activation: ActivationRecord;
    plan: 'PREMIUM' | 'FAMILY' | 'BUSINESS';
    billingCycle: 'monthly' | 'annual' | 'custom';
    durationDays: number;
  }> {
    if (!auth.currentUser || auth.currentUser.uid !== params.uid) {
      throw new Error('Veuillez vous connecter pour activer un code Redeem.');
    }

    const normalized = normalizeRedeemCode(params.code);
    if (!normalized) {
      throw new Error('Veuillez saisir un code Redeem valide.');
    }

    const codeHash = await hashRedeemCodeClient(normalized);
    const fallbackMasked = maskRedeemCodeClient(normalized);
    const codeRef = doc(db, 'redeem_codes', codeHash);
    const claimId = `${codeHash}_${params.uid}`;
    const claimRef = doc(db, 'redeem_claims', claimId);
    const subRef = doc(db, 'subscriptions', params.uid);

    try {
      const txResult = await runTransaction(db, async (transaction) => {
        const [codeSnap, claimSnap, subSnap] = await Promise.all([
          transaction.get(codeRef),
          transaction.get(claimRef),
          transaction.get(subRef),
        ]);

        if (!codeSnap.exists()) {
          throw new Error(
            'Code Redeem introuvable. Vérifiez la saisie ou contactez un administrateur.'
          );
        }

        const codeData = codeSnap.data() as Record<string, any>;
        const nowMs = Date.now();
        const expiresAt = toMs(codeData.expiresAt);

        if (codeData.status === 'revoked') {
          throw new Error('Ce code Redeem a été révoqué par un administrateur.');
        }
        if (codeData.status === 'disabled') {
          throw new Error('Ce code Redeem est temporairement désactivé.');
        }
        if (codeData.status === 'expired' || (expiresAt !== null && expiresAt <= nowMs)) {
          throw new Error('Ce code Redeem est expiré.');
        }

        if (claimSnap.exists()) {
          throw new Error('Vous avez déjà utilisé ce code Redeem sur votre compte.');
        }

        const maxUses = typeof codeData.maxUses === 'number' ? codeData.maxUses : 1;
        const currentUses = typeof codeData.usesCount === 'number' ? codeData.usesCount : 0;
        if (codeData.status === 'used' || currentUses >= maxUses) {
          throw new Error('Ce code Redeem a déjà atteint sa limite d’utilisation.');
        }

        const plan = codeData.plan as 'PREMIUM' | 'FAMILY' | 'BUSINESS';
        if (params.expectedPlan && plan !== params.expectedPlan) {
          throw new Error(
            `Ce code correspond à l'abonnement ${plan}. Sélectionnez la formule ${plan} pour l'activer.`
          );
        }

        const existingSub = subSnap.exists() ? (subSnap.data() as Record<string, any>) : null;
        if (existingSub?.status === 'suspended') {
          throw new Error('Votre abonnement est suspendu par l’administration.');
        }

        const durationCode: RedeemDurationCode =
          (codeData.durationCode as RedeemDurationCode) || '1m';
        const isLifetime = Boolean(codeData.isLifetime);
        const durationDays = isLifetime
          ? null
          : typeof codeData.durationDays === 'number' && codeData.durationDays > 0
          ? codeData.durationDays
          : resolveDurationDaysForRedeem(durationCode) ?? 30;
        const durationMs = (durationDays ?? 30) * DAY_MS;
        const billingCycle: BillingCycle =
          (codeData.billingCycle as BillingCycle) || resolveBillingCycleForDuration(durationCode);

        const existingStartMs = toMs(existingSub?.startDate);
        const existingEndMs = toMs(existingSub?.endDate);
        const canExtendExisting =
          !isLifetime &&
          existingSub !== null &&
          existingSub.plan === plan &&
          existingSub.status === 'active' &&
          existingEndMs !== null &&
          existingEndMs > nowMs;

        const baseStartMs = canExtendExisting && existingEndMs ? existingEndMs : nowMs;
        const computedEndMs = isLifetime ? null : baseStartMs + durationMs;
        const subStartMs = existingStartMs ?? nowMs;
        const maskedLabel = String(codeData.maskedCode || codeData.code || fallbackMasked);

        const nextUses = currentUses + 1;
        const nextStatus: RedeemCodeStatus = nextUses >= maxUses ? 'used' : 'available';

        // 1. Atomically consume one use of the Redeem Code
        transaction.update(codeRef, {
          usesCount: nextUses,
          status: nextStatus,
          usedAt: serverTimestamp(),
        });

        // 2. Atomically record one-claim-per-user proof (no PII exposed on redeem_codes)
        transaction.set(claimRef, {
          id: claimId,
          codeHash,
          maskedCode: maskedLabel,
          uid: params.uid,
          email: params.email || null,
          plan,
          billingCycle,
          durationCode,
          durationDays,
          isLifetime,
          startDate: baseStartMs,
          endDate: computedEndMs,
          usedAt: serverTimestamp(),
        });

        // 3. Atomically activate or extend /subscriptions/{uid}
        if (subSnap.exists()) {
          transaction.update(subRef, {
            email: params.email || existingSub?.email || null,
            plan,
            basePlan: plan,
            status: 'active',
            billingCycle,
            startDate: Timestamp.fromMillis(subStartMs),
            endDate: computedEndMs !== null ? Timestamp.fromMillis(computedEndMs) : null,
            isLifetime,
            cancelAtPeriodEnd: false,
            activationSource: 'redeem',
            paymentProvider: 'redeem',
            paymentVerified: true,
            lastPaymentRef: maskedLabel,
            redeemCodeHash: codeHash,
            updatedAt: serverTimestamp(),
          });
        } else {
          transaction.set(subRef, {
            uid: params.uid,
            email: params.email || null,
            plan,
            basePlan: plan,
            status: 'active',
            billingCycle,
            startDate: Timestamp.fromMillis(nowMs),
            endDate: computedEndMs !== null ? Timestamp.fromMillis(computedEndMs) : null,
            isLifetime,
            cancelAtPeriodEnd: false,
            isEarlyTester: false,
            earlyTesterStartDate: null,
            earlyTesterEndDate: null,
            activationSource: 'redeem',
            paymentProvider: 'redeem',
            paymentVerified: true,
            lastPaymentRef: maskedLabel,
            redeemCodeHash: codeHash,
            updatedAt: serverTimestamp(),
          });
        }

        const resolvedSub = resolveEffectiveSubscription(
          {
            uid: params.uid,
            email: params.email || existingSub?.email || null,
            plan,
            status: 'active',
            billingCycle,
            startDate: subStartMs,
            endDate: computedEndMs,
            isLifetime,
            cancelAtPeriodEnd: false,
            isEarlyTester: Boolean(existingSub?.isEarlyTester),
            earlyTesterStartDate: toMs(existingSub?.earlyTesterStartDate),
            earlyTesterEndDate: toMs(existingSub?.earlyTesterEndDate),
            activationSource: 'redeem',
            paymentProvider: 'redeem',
            paymentVerified: true,
            lastPaymentRef: maskedLabel,
            updatedAt: nowMs,
          },
          nowMs
        );

        const activation: ActivationRecord = {
          id: claimId,
          uid: params.uid,
          email: params.email || null,
          plan,
          billingCycle,
          source: 'redeem',
          code: maskedLabel,
          startDate: baseStartMs,
          endDate: computedEndMs,
          isLifetime,
          activatedAt: nowMs,
        };

        return {
          subscription: resolvedSub,
          activation,
          plan,
          billingCycle: (billingCycle === 'annual' || billingCycle === 'monthly'
            ? billingCycle
            : 'custom') as 'monthly' | 'annual' | 'custom',
          durationDays: durationDays ?? 0,
        };
      });

      return txResult;
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, `redeem_codes/${codeHash}`);
      }
      throw err;
    }
  },

  async listRedeemClaimsFromFirestore(): Promise<{
    claimsByHash: Map<string, RedeemCodeUsageEntry[]>;
    activations: ActivationRecord[];
  }> {
    try {
      const snap = await getDocs(collection(db, 'redeem_claims'));
      const claimsByHash = new Map<string, RedeemCodeUsageEntry[]>();
      const activations: ActivationRecord[] = [];

      snap.docs.forEach((d) => {
        const raw = d.data() as Record<string, any>;
        const codeHash = String(raw.codeHash || '');
        const usedAt = toMs(raw.usedAt) ?? toMs(raw.startDate) ?? Date.now();
        if (codeHash) {
          const list = claimsByHash.get(codeHash) || [];
          list.push({
            uid: String(raw.uid || ''),
            email: raw.email ?? null,
            usedAt,
          });
          claimsByHash.set(codeHash, list);
        }
        activations.push({
          id: raw.id || d.id,
          uid: String(raw.uid || ''),
          email: raw.email ?? null,
          plan: (raw.plan as SubscriptionPlan) || 'PREMIUM',
          billingCycle: (raw.billingCycle as BillingCycle) || 'monthly',
          source: 'redeem',
          code: raw.maskedCode || null,
          startDate: toMs(raw.startDate) ?? usedAt,
          endDate: toMs(raw.endDate),
          isLifetime: Boolean(raw.isLifetime),
          activatedAt: usedAt,
        });
      });

      activations.sort((a, b) => b.activatedAt - a.activatedAt);
      return { claimsByHash, activations };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, 'redeem_claims');
      }
      return { claimsByHash: new Map(), activations: [] };
    }
  },

  async getUserRedeemActivationsFromFirestore(uid: string): Promise<ActivationRecord[]> {
    if (!auth.currentUser || auth.currentUser.uid !== uid) return [];
    try {
      const snap = await getDocs(query(collection(db, 'redeem_claims'), where('uid', '==', uid)));
      return snap.docs
        .map((d) => {
          const raw = d.data() as Record<string, any>;
          const usedAt = toMs(raw.usedAt) ?? toMs(raw.startDate) ?? Date.now();
          return {
            id: raw.id || d.id,
            uid: String(raw.uid || uid),
            email: raw.email ?? null,
            plan: (raw.plan as SubscriptionPlan) || 'PREMIUM',
            billingCycle: (raw.billingCycle as BillingCycle) || 'monthly',
            source: 'redeem' as const,
            code: raw.maskedCode || null,
            startDate: toMs(raw.startDate) ?? usedAt,
            endDate: toMs(raw.endDate),
            isLifetime: Boolean(raw.isLifetime),
            activatedAt: usedAt,
          } satisfies ActivationRecord;
        })
        .sort((a, b) => b.activatedAt - a.activatedAt);
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, 'redeem_claims');
      }
      return [];
    }
  },

  async listRedeemCodesFromFirestore(): Promise<{
    codes: RedeemCodeRecord[];
    stats: AdminOverviewStats;
    activations: ActivationRecord[];
  }> {
    try {
      const [codesSnap, claimsData, subsSnap] = await Promise.all([
        getDocs(collection(db, 'redeem_codes')),
        this.listRedeemClaimsFromFirestore(),
        getDocs(collection(db, 'subscriptions')).catch(() => null),
      ]);

      const codes = codesSnap.docs
        .map((d) => sanitizeStoredRedeemDoc(d.id, d.data() as Record<string, any>, claimsData.claimsByHash))
        .sort((a, b) => b.createdAt - a.createdAt);

      const subscriptions: UserSubscription[] = subsSnap
        ? subsSnap.docs.map((d) => mapFirestoreSubscriptionDoc(d.id, d.data() as Record<string, any>))
        : [];

      return {
        codes,
        stats: buildRedeemOverviewStats(codes, subscriptions),
        activations: claimsData.activations,
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.LIST, 'redeem_codes');
      }
      throw err;
    }
  },

  async generateRedeemCodesInFirestore(params: {
    plan: 'PREMIUM' | 'FAMILY' | 'BUSINESS';
    durationCode: RedeemDurationCode;
    count: number;
    maxUses?: number;
    expiresAt?: number | null;
    campaign?: string;
    note?: string;
  }): Promise<{
    generatedCodes: RedeemCodeRecord[];
    maskedCodes: RedeemCodeRecord[];
    stats: AdminOverviewStats;
  }> {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('Authentification administrateur requise.');
    }

    const safeCount = Math.min(100, Math.max(1, Math.floor(params.count || 1)));
    const safeMaxUses = Math.min(1000, Math.max(1, Math.floor(params.maxUses || 1)));
    const durationCode: RedeemDurationCode = params.durationCode || '1m';
    const isLifetime = durationCode === 'lifetime';
    const durationDays = isLifetime ? null : resolveDurationDaysForRedeem(durationCode) ?? 30;
    const billingCycle = resolveBillingCycleForDuration(durationCode);
    const now = Date.now();
    const createdBy = (currentUser.email || currentUser.uid).slice(0, 256);
    const cleanCampaign = params.campaign?.trim() ? params.campaign.trim().slice(0, 120) : null;
    const cleanNote = params.note?.trim() ? params.note.trim().slice(0, 300) : null;

    const batch = writeBatch(db);
    const generatedCodes: RedeemCodeRecord[] = [];
    const seenHashes = new Set<string>();

    for (let i = 0; i < safeCount; i++) {
      let plainCode = '';
      let codeHash = '';
      let guard = 0;
      do {
        plainCode = generateRandomRedeemCode(params.plan);
        codeHash = await hashRedeemCodeClient(plainCode);
        guard++;
      } while (seenHashes.has(codeHash) && guard < 10);
      seenHashes.add(codeHash);

      const id = `rc_${now}_${createIdSuffix(4)}`;
      const maskedCode = maskRedeemCodeClient(plainCode);

      const firestoreDoc = {
        id,
        code: maskedCode,
        maskedCode,
        codeHash,
        plan: params.plan,
        billingCycle,
        durationCode,
        durationDays,
        isLifetime,
        maxUses: safeMaxUses,
        usesCount: 0,
        expiresAt: params.expiresAt ?? null,
        status: 'available' as RedeemCodeStatus,
        createdAt: serverTimestamp(),
        createdBy,
        campaign: cleanCampaign,
        note: cleanNote,
        usedAt: null,
      };

      batch.set(doc(db, 'redeem_codes', codeHash), firestoreDoc);

      generatedCodes.push({
        id,
        code: plainCode,
        maskedCode,
        codeHash,
        plan: params.plan,
        billingCycle,
        durationCode,
        durationDays,
        isLifetime,
        maxUses: safeMaxUses,
        usesCount: 0,
        expiresAt: params.expiresAt ?? null,
        status: 'available',
        createdAt: now,
        createdBy,
        campaign: cleanCampaign ?? undefined,
        note: cleanNote ?? undefined,
        usedByUid: null,
        usedByEmail: null,
        usedAt: null,
        usageHistory: [],
      });
    }

    try {
      await batch.commit();
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.WRITE, 'redeem_codes');
      }
      throw err;
    }

    const listed = await this.listRedeemCodesFromFirestore();
    return {
      generatedCodes,
      maskedCodes: listed.codes,
      stats: listed.stats,
    };
  },

  async mirrorGeneratedCodesToFirestore(generatedCodes: RedeemCodeRecord[]): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser || !Array.isArray(generatedCodes) || generatedCodes.length === 0) return;

    try {
      const batch = writeBatch(db);
      for (const rec of generatedCodes) {
        const normalized = normalizeRedeemCode(rec.code);
        const codeHash =
          rec.codeHash && /^[a-f0-9]{64}$/.test(rec.codeHash)
            ? rec.codeHash
            : rec.code && !rec.code.includes('•')
            ? await hashRedeemCodeClient(normalized)
            : null;
        if (!codeHash) continue;

        const maskedCode = rec.maskedCode || maskRedeemCodeClient(normalized);
        const durationCode: RedeemDurationCode =
          rec.durationCode || (rec.billingCycle === 'annual' ? '12m' : '1m');
        const isLifetime = Boolean(rec.isLifetime || durationCode === 'lifetime');
        const durationDays = isLifetime
          ? null
          : typeof rec.durationDays === 'number' && rec.durationDays > 0
          ? rec.durationDays
          : resolveDurationDaysForRedeem(durationCode) ?? 30;
        const id = rec.id && /^[a-zA-Z0-9_-]{1,128}$/.test(rec.id)
          ? rec.id
          : `rc_${rec.createdAt || Date.now()}_${createIdSuffix(4)}`;

        batch.set(
          doc(db, 'redeem_codes', codeHash),
          {
            id,
            code: maskedCode,
            maskedCode,
            codeHash,
            plan: rec.plan,
            billingCycle: rec.billingCycle || resolveBillingCycleForDuration(durationCode),
            durationCode,
            durationDays,
            isLifetime,
            maxUses: Math.min(1000, Math.max(1, Number(rec.maxUses || 1))),
            usesCount: Math.max(0, Number(rec.usesCount || 0)),
            expiresAt: rec.expiresAt ?? null,
            status: rec.status || 'available',
            createdAt: typeof rec.createdAt === 'number' && rec.createdAt > 0 ? rec.createdAt : Date.now(),
            createdBy: String(rec.createdBy || currentUser.email || currentUser.uid).slice(0, 256),
            campaign: rec.campaign ? String(rec.campaign).slice(0, 120) : null,
            note: rec.note ? String(rec.note).slice(0, 300) : null,
            usedAt: rec.usedAt ?? null,
          },
          { merge: true }
        );
      }
      await batch.commit();
    } catch (err) {
      console.warn('Firestore redeem code mirror skipped:', err);
    }
  },

  async updateRedeemCodeStatusInFirestore(params: {
    idOrHash: string;
    action: 'revoke' | 'disable' | 'enable';
  }): Promise<{ code: RedeemCodeRecord; stats: AdminOverviewStats }> {
    const clean = params.idOrHash.trim();
    try {
      const codesCol = collection(db, 'redeem_codes');
      let targetDoc: { id: string; data: Record<string, any> } | null = null;

      if (/^[a-f0-9]{64}$/.test(clean)) {
        const snap = await getDocs(query(codesCol, where('codeHash', '==', clean)));
        if (!snap.empty) {
          targetDoc = { id: snap.docs[0].id, data: snap.docs[0].data() as Record<string, any> };
        }
      }

      if (!targetDoc) {
        const byIdSnap = await getDocs(query(codesCol, where('id', '==', clean)));
        if (!byIdSnap.empty) {
          targetDoc = { id: byIdSnap.docs[0].id, data: byIdSnap.docs[0].data() as Record<string, any> };
        }
      }

      if (!targetDoc) {
        const byMaskedSnap = await getDocs(query(codesCol, where('maskedCode', '==', clean)));
        if (!byMaskedSnap.empty) {
          targetDoc = {
            id: byMaskedSnap.docs[0].id,
            data: byMaskedSnap.docs[0].data() as Record<string, any>,
          };
        }
      }

      if (!targetDoc && !clean.includes('•')) {
        const normalized = normalizeRedeemCode(clean);
        const hash = await hashRedeemCodeClient(normalized);
        const byHashSnap = await getDocs(query(codesCol, where('codeHash', '==', hash)));
        if (!byHashSnap.empty) {
          targetDoc = {
            id: byHashSnap.docs[0].id,
            data: byHashSnap.docs[0].data() as Record<string, any>,
          };
        }
      }

      if (!targetDoc) {
        throw new Error('Code Redeem introuvable.');
      }

      const raw = targetDoc.data;
      if (raw.status === 'used' && params.action !== 'enable') {
        throw new Error('Ce code a déjà été entièrement utilisé.');
      }

      const expiresAt = toMs(raw.expiresAt);
      let nextStatus: RedeemCodeStatus = raw.status;
      if (params.action === 'revoke') {
        nextStatus = 'revoked';
      } else if (params.action === 'disable') {
        nextStatus = 'disabled';
      } else if (params.action === 'enable') {
        if (expiresAt !== null && expiresAt <= Date.now()) {
          throw new Error('Impossible de réactiver un code expiré.');
        }
        nextStatus = (raw.usesCount || 0) >= (raw.maxUses || 1) ? 'used' : 'available';
      }

      await updateDoc(doc(db, 'redeem_codes', targetDoc.id), { status: nextStatus });

      const listed = await this.listRedeemCodesFromFirestore();
      const updatedCode =
        listed.codes.find((c) => c.codeHash === targetDoc!.id || c.id === raw.id) ||
        sanitizeStoredRedeemDoc(targetDoc.id, { ...raw, status: nextStatus }, new Map());

      return {
        code: updatedCode,
        stats: listed.stats,
      };
    } catch (err) {
      if (isPermissionDeniedError(err)) {
        handleFirestoreError(err, OperationType.UPDATE, `redeem_codes/${clean}`);
      }
      throw err;
    }
  },

  async mirrorRedeemStatusToFirestore(
    idOrCode: string,
    action: 'revoke' | 'disable' | 'enable'
  ): Promise<void> {
    try {
      await this.updateRedeemCodeStatusInFirestore({ idOrHash: idOrCode, action });
    } catch {
      // Best-effort sync for legacy Express-only records not yet mirrored
    }
  },

  triggerLocalCsvDownload(codes: RedeemCodeRecord[]): void {
    const csv = buildRedeemCsvContent(codes);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vruguard-redeem-codes-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async getLegacyAdminOverviewFromFirestore(): Promise<{
    subscriptions: UserSubscription[];
    businessQuotes: BusinessQuoteRequest[];
    redeemCodes: RedeemCodeRecord[];
    activations: ActivationRecord[];
    stats: AdminOverviewStats;
  }> {
    const [subsSnap, quotesSnap, codesData] = await Promise.all([
      getDocs(collection(db, 'subscriptions')).catch(() => null),
      getDocs(collection(db, 'business_quotes')).catch(() => null),
      this.listRedeemCodesFromFirestore(),
    ]);

    const subscriptions: UserSubscription[] = subsSnap
      ? subsSnap.docs.map((d) => mapFirestoreSubscriptionDoc(d.id, d.data() as Record<string, any>))
      : [];

    const businessQuotes: BusinessQuoteRequest[] = quotesSnap
      ? quotesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) } as BusinessQuoteRequest))
      : [];

    return {
      subscriptions,
      businessQuotes,
      redeemCodes: codesData.codes,
      activations: codesData.activations,
      stats: buildRedeemOverviewStats(codesData.codes, subscriptions),
    };
  },

  async getSuperAdminOverviewFromFirestore(): Promise<any> {
    const [usersSnap, subsSnap, accSnap, quotesSnap, codesData] = await Promise.all([
      getDocs(collection(db, 'users')).catch(() => null),
      getDocs(collection(db, 'subscriptions')).catch(() => null),
      getDocs(collection(db, 'accessibility_requests')).catch(() => null),
      getDocs(collection(db, 'business_quotes')).catch(() => null),
      this.listRedeemCodesFromFirestore().catch(() => ({
        codes: [] as RedeemCodeRecord[],
        stats: buildRedeemOverviewStats([], []),
        activations: [] as ActivationRecord[],
      })),
    ]);

    const usersCount = usersSnap ? usersSnap.size : 0;
    const subs = subsSnap
      ? subsSnap.docs.map((d) => mapFirestoreSubscriptionDoc(d.id, d.data() as Record<string, any>))
      : [];
    const subStats = buildRedeemOverviewStats(codesData.codes, subs);
    const totalUsers = Math.max(usersCount, subs.length);
    const freeUsers = Math.max(
      0,
      totalUsers - subStats.premiumUsers - subStats.familyUsers - subStats.businessUsers
    );
    const pendingAccessibility = accSnap
      ? accSnap.docs.filter((d) => (d.data() as any).status === 'pending').length
      : 0;
    const newBusinessQuotes = quotesSnap
      ? quotesSnap.docs.filter((d) => (d.data() as any).status === 'new').length
      : 0;

    return {
      kpis: {
        totalUsers,
        activeUsers: totalUsers,
        newToday: 0,
        newThisWeek: 0,
        bannedUsers: 0,
        suspendedUsers: subStats.suspendedSubscriptions,
        deletedUsers: 0,
        onlineUsers: 0,
        idleUsers: 0,
        offlineUsers: totalUsers,
        freeUsers,
        premiumUsers: subStats.premiumUsers,
        familyUsers: subStats.familyUsers,
        businessUsers: subStats.businessUsers,
        activeSubscriptions:
          subStats.premiumUsers + subStats.familyUsers + subStats.businessUsers,
        expiredSubscriptions: subStats.expiredSubscriptions,
        suspendedSubscriptions: subStats.suspendedSubscriptions,
        lifetimeSubscriptions: subStats.lifetimeUsers,
        pioneerUsers: subStats.earlyTesterUsers,
        totalCodes: subStats.totalCodes,
        availableCodes: subStats.availableCodes,
        usedCodes: subStats.usedCodes,
        expiredCodes: subStats.expiredCodes,
        revokedCodes: subStats.revokedCodes,
        disabledCodes: subStats.disabledCodes,
        pendingAccessibility,
        openSupportTickets: 0,
        newBusinessQuotes,
      },
      dailySeries: [],
      planDistribution: [
        { name: 'Free', value: freeUsers, color: '#64748b' },
        { name: 'Premium', value: subStats.premiumUsers, color: '#3b82f6' },
        { name: 'Family', value: subStats.familyUsers, color: '#10b981' },
        { name: 'Business', value: subStats.businessUsers, color: '#f59e0b' },
      ],
      recentAuditLogs: [],
      recentActivations: codesData.activations.slice(0, 30),
      serverCapabilities: { hasAdminIam: false },
    };
  },

  async mirrorVerifiedSubscriptionIfAdmin(sub: UserSubscription): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser || !sub?.uid) return;
    try {
      await setDoc(
        doc(db, 'subscriptions', sub.uid),
        {
          uid: sub.uid,
          email: sub.email ?? null,
          plan: sub.effectivePlan,
          basePlan: sub.plan,
          status: sub.status,
          billingCycle: sub.billingCycle,
          startDate: Timestamp.fromMillis(sub.startDate || Date.now()),
          endDate: sub.endDate ? Timestamp.fromMillis(sub.endDate) : null,
          isLifetime: Boolean(sub.isLifetime),
          cancelAtPeriodEnd: Boolean(sub.cancelAtPeriodEnd),
          isEarlyTester: Boolean(sub.isEarlyTester),
          earlyTesterStartDate: sub.earlyTesterStartDate
            ? Timestamp.fromMillis(sub.earlyTesterStartDate)
            : null,
          earlyTesterEndDate: sub.earlyTesterEndDate
            ? Timestamp.fromMillis(sub.earlyTesterEndDate)
            : null,
          activationSource: sub.activationSource || 'free',
          paymentProvider: sub.paymentProvider ?? null,
          paymentVerified: Boolean(sub.paymentVerified),
          lastPaymentRef: sub.lastPaymentRef ?? null,
          updatedAt: Timestamp.fromMillis(sub.updatedAt || Date.now()),
        },
        { merge: true }
      );
    } catch {
      // Ignore if not admin
    }
  },
};
