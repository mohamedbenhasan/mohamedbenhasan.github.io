import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import multer from "multer";
import { createServer as createViteServer } from "vite";
import http from "http";
import net from "net";
import { WebSocketServer, WebSocket } from "ws";
import cors from "cors";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import { APK_TMP_DIR, subscriptionStore } from "./server/subscriptionStore";
import { sanitizeApkFileName, validateAndInspectApkFile } from "./server/apkValidator";
import { heatmapStore, severityTierFromScore } from "./server/heatmapStore";
import { inspectHeatmapZone, queryHeatmap } from "./server/heatmapEngine";
import {
  ActivationSource,
  AdminRole,
  AndroidReleaseStatus,
  AndroidUpdateType,
  BillingCycle,
  ConsentPlatform,
  FeatureKey,
  RedeemDurationCode,
  SubscriptionPlan,
  SupportedCurrency,
  SupportTicketStatus,
  UserSubscription,
} from "./types";
import {
  getCompatibleProvidersForCurrency,
  getCurrencyForCountry,
  getRequiredPlanForFeature,
  hasFeatureAccess,
  isProviderCompatibleWithCurrency,
  SUBSCRIPTION_PLANS,
  toStripeUnitAmount,
} from "./utils/subscriptionPlans";

interface FirebaseAppletConfig {
  projectId: string;
  firestoreDatabaseId?: string;
}

function loadFirebaseConfig(): FirebaseAppletConfig {
  try {
    const cfgPath = path.join(process.cwd(), "firebase-applet-config.json");
    return JSON.parse(fs.readFileSync(cfgPath, "utf8")) as FirebaseAppletConfig;
  } catch {
    return { projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0061104847" };
  }
}

const firebaseConfig = loadFirebaseConfig();

let adminFirestore: ReturnType<typeof getAdminFirestore> | null = null;
let hasAdminIam = false;

if (!getApps().length) {
  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (saRaw) {
    try {
      const sa = JSON.parse(saRaw);
      const appInstance = initializeApp({
        credential: cert(sa),
        projectId: firebaseConfig.projectId,
      });
      adminFirestore = firebaseConfig.firestoreDatabaseId
        ? getAdminFirestore(appInstance, firebaseConfig.firestoreDatabaseId)
        : getAdminFirestore(appInstance);
      hasAdminIam = true;
    } catch (e) {
      console.warn("Invalid FIREBASE_SERVICE_ACCOUNT_KEY, initializing token-only verifier:", e);
      initializeApp({ projectId: firebaseConfig.projectId });
    }
  } else {
    // Starter Tier / token verification mode: verifyIdToken() works without service account IAM
    initializeApp({ projectId: firebaseConfig.projectId });
  }
}

interface AuthenticatedRequest extends Request {
  authUser?: {
    uid: string;
    email: string | null;
    emailVerified: boolean;
    name: string | null;
    picture: string | null;
    authTimeMs: number;
    idToken: string;
    role: AdminRole;
  };
  userSubscription?: UserSubscription;
}

// In-memory sliding-window rate limiter
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateBuckets.get(key) || []).filter((ts) => now - ts < windowMs);
  if (timestamps.length >= maxRequests) {
    rateBuckets.set(key, timestamps);
    return false;
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return true;
}

function getClientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function isPrivateOrLocalIp(ip: string): boolean {
  const clean = ip.replace(/^::ffff:/i, "").trim().toLowerCase();
  if (!clean || clean === "unknown" || clean === "::1" || clean === "localhost") return true;
  if (clean.startsWith("127.") || clean.startsWith("10.") || clean.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(clean)) return true;
  if (clean.startsWith("fc") || clean.startsWith("fd") || clean.startsWith("fe80:")) return true;
  return false;
}

const geoIpCache = new Map<string, { country: string | null; expiresAt: number }>();

export interface VisitorGeoContext {
  country: string | null;
  currency: SupportedCurrency;
  source: "header" | "geoip" | "fallback";
}

async function resolveVisitorGeo(req: Request): Promise<VisitorGeoContext> {
  const headerKeys = [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-appengine-country",
    "cloudfront-viewer-country",
    "x-country-code",
  ];
  for (const key of headerKeys) {
    const raw = req.headers[key];
    const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    if (/^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "ZZ" && code !== "T1") {
      return {
        country: code,
        currency: getCurrencyForCountry(code),
        source: "header",
      };
    }
  }

  const rawIp = getClientIp(req).replace(/^::ffff:/i, "").trim();
  if (isPrivateOrLocalIp(rawIp)) {
    return {
      country: null,
      currency: "EUR",
      source: "fallback",
    };
  }

  const cached = geoIpCache.get(rawIp);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      country: cached.country,
      currency: getCurrencyForCountry(cached.country),
      source: cached.country ? "geoip" : "fallback",
    };
  }

  let detectedCountry: string | null = null;
  try {
    const resp = await fetch(`https://ipapi.co/${encodeURIComponent(rawIp)}/country/`, {
      signal: AbortSignal.timeout(1800),
      headers: { Accept: "text/plain" },
    });
    if (resp.ok) {
      const txt = (await resp.text()).trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(txt)) {
        detectedCountry = txt;
      }
    }
  } catch {
    // Fallback to ip-api if primary lookup timed out
    try {
      const resp2 = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(rawIp)}?fields=status,countryCode`,
        { signal: AbortSignal.timeout(1800) }
      );
      if (resp2.ok) {
        const data = (await resp2.json()) as { status?: string; countryCode?: string };
        if (data.status === "success" && data.countryCode && /^[A-Z]{2}$/.test(data.countryCode)) {
          detectedCountry = data.countryCode.toUpperCase();
        }
      }
    } catch {
      // keep fallback EUR
    }
  }

  geoIpCache.set(rawIp, {
    country: detectedCountry,
    expiresAt: Date.now() + 6 * 60 * 60 * 1000,
  });

  return {
    country: detectedCountry,
    currency: getCurrencyForCountry(detectedCountry),
    source: detectedCountry ? "geoip" : "fallback",
  };
}

// Parse Firestore REST typed values cleanly
function decodeFirestoreValue(val: any): any {
  if (!val || typeof val !== "object") return val;
  if ("stringValue" in val) return val.stringValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("doubleValue" in val) return Number(val.doubleValue);
  if ("booleanValue" in val) return Boolean(val.booleanValue);
  if ("nullValue" in val) return null;
  if ("timestampValue" in val) {
    const ms = Date.parse(val.timestampValue);
    return Number.isNaN(ms) ? val.timestampValue : ms;
  }
  if ("arrayValue" in val) {
    return (val.arrayValue?.values || []).map(decodeFirestoreValue);
  }
  if ("mapValue" in val) {
    const out: Record<string, any> = {};
    const fields = val.mapValue?.fields || {};
    Object.entries(fields).forEach(([k, v]) => {
      out[k] = decodeFirestoreValue(v);
    });
    return out;
  }
  return val;
}

function decodeFirestoreDocument(docItem: any): Record<string, any> {
  const name: string = docItem?.name || "";
  const id = name.split("/").pop() || "";
  const fields = docItem?.fields || {};
  const obj: Record<string, any> = { id };
  Object.entries(fields).forEach(([k, v]) => {
    obj[k] = decodeFirestoreValue(v);
  });
  return obj;
}

async function fetchFirestoreCollectionWithToken(
  collectionName: string,
  idToken: string
): Promise<Record<string, any>[]> {
  if (adminFirestore) {
    try {
      const snap = await adminFirestore.collection(collectionName).limit(500).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
      // Fallback to REST with caller's verified token
    }
  }
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(
      dbId
    )}/documents/${encodeURIComponent(collectionName)}?pageSize=300`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const docs = Array.isArray(data?.documents) ? data.documents : [];
    return docs.map(decodeFirestoreDocument);
  } catch {
    return [];
  }
}

async function fetchMergedUsersFromFirestore(idToken: string) {
  const [fsUsers, fsProfiles] = await Promise.all([
    fetchFirestoreCollectionWithToken("users", idToken),
    fetchFirestoreCollectionWithToken("public_profiles", idToken),
  ]);

  const profileMap = new Map<string, any>();
  fsProfiles.forEach((p) => {
    const uid = p.uid || p.id;
    if (uid) profileMap.set(uid, p);
  });

  return fsUsers.map((u) => {
    const uid = u.uid || u.id;
    const prof = profileMap.get(uid);
    const createdAt =
      typeof u.createdAt === "number"
        ? u.createdAt
        : u.createdAt?.toMillis?.() || null;
    const lastActiveAt =
      typeof prof?.lastActiveAt === "number"
        ? prof.lastActiveAt
        : prof?.lastActiveAt?.toMillis?.() || null;

    return {
      uid,
      email: u.email || null,
      displayName: u.displayName || prof?.displayName || null,
      photoURL: u.photoURL || prof?.photoURL || null,
      createdAt,
      lastActiveAt,
    };
  });
}

// Cache immutable user creation timestamps fetched via Firestore REST with user's token
const userCreatedAtCache = new Map<string, number>();

async function fetchUserCreatedAtMs(uid: string, idToken: string): Promise<number | null> {
  if (userCreatedAtCache.has(uid)) {
    return userCreatedAtCache.get(uid) ?? null;
  }
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(
      dbId
    )}/documents/users/${uid}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!resp.ok) return null;
    const docData = await resp.json();
    const tsIso = docData?.fields?.createdAt?.timestampValue;
    if (tsIso) {
      const ms = Date.parse(tsIso);
      if (!Number.isNaN(ms)) {
        userCreatedAtCache.set(uid, ms);
        return ms;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function mirrorSubscriptionToAdminFirestore(sub: UserSubscription): Promise<void> {
  if (!adminFirestore) return;
  try {
    await adminFirestore.collection("subscriptions").doc(sub.uid).set(
      {
        uid: sub.uid,
        plan: sub.effectivePlan,
        basePlan: sub.plan,
        status: sub.status,
        billingCycle: sub.billingCycle,
        startDate: new Date(sub.startDate),
        endDate: sub.endDate ? new Date(sub.endDate) : null,
        cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
        isEarlyTester: sub.isEarlyTester,
        earlyTesterStartDate: sub.earlyTesterStartDate ? new Date(sub.earlyTesterStartDate) : null,
        earlyTesterEndDate: sub.earlyTesterEndDate ? new Date(sub.earlyTesterEndDate) : null,
        paymentProvider: sub.paymentProvider,
        paymentVerified: sub.paymentVerified,
        lastPaymentRef: sub.lastPaymentRef,
        updatedAt: new Date(sub.updatedAt),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Optional Admin Firestore mirror skipped:", (err as Error).message);
  }
}

async function extractVerifiedToken(req: Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) return null;
  const decoded = await getAuth().verifyIdToken(idToken);
  return { decoded, idToken };
}

async function authenticateRequest(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const tokenResult = await extractVerifiedToken(req);
    if (!tokenResult) {
      return res.status(401).json({ error: "Authentification requise.", code: "UNAUTHENTICATED" });
    }
    const { decoded, idToken } = tokenResult;
    const authTimeMs = (decoded.auth_time || Math.floor(Date.now() / 1000)) * 1000;
    const email = decoded.email || null;
    const emailVerified = Boolean(decoded.email_verified);
    const createdAtMs = await fetchUserCreatedAtMs(decoded.uid, idToken);

    const dir = subscriptionStore.upsertDirectoryUser({
      uid: decoded.uid,
      email,
      displayName: (decoded as any).name || null,
      photoURL: (decoded as any).picture || null,
      emailVerified,
      createdAt: createdAtMs,
      lastLoginAt: Date.now(),
    });

    // Enforce session revocation & account sanctions server-side
    if (dir.revokedAfter && authTimeMs < dir.revokedAfter) {
      return res.status(401).json({
        error: "Votre session a été révoquée par l’administration. Veuillez vous reconnecter.",
        code: "SESSION_REVOKED",
      });
    }
    if (dir.accountStatus === "banned") {
      return res.status(403).json({
        error: dir.banReason
          ? `Ce compte a été banni : ${dir.banReason}`
          : "Ce compte a été banni définitivement.",
        code: "ACCOUNT_BANNED",
      });
    }
    if (dir.accountStatus === "suspended") {
      return res.status(403).json({
        error: dir.suspensionReason
          ? `Ce compte est suspendu : ${dir.suspensionReason}`
          : "Ce compte est temporairement suspendu.",
        code: "ACCOUNT_SUSPENDED",
        suspensionExpiresAt: dir.suspensionExpiresAt,
      });
    }
    if (dir.accountStatus === "soft_deleted") {
      return res.status(403).json({
        error: "Ce compte a été désactivé / supprimé.",
        code: "ACCOUNT_DELETED",
      });
    }

    req.authUser = {
      uid: decoded.uid,
      email,
      emailVerified,
      name: (decoded as any).name || dir.displayName || null,
      picture: (decoded as any).picture || dir.photoURL || null,
      authTimeMs,
      idToken,
      role: dir.role,
    };

    req.userSubscription = subscriptionStore.getUserSubscription(decoded.uid, {
      email,
      userCreatedAtMs: createdAtMs,
    });
    next();
  } catch (err) {
    console.warn("Token verification failed:", (err as Error).message);
    return res.status(401).json({ error: "Jeton d'authentification invalide.", code: "INVALID_TOKEN" });
  }
}

function requireSuperAdminPermission(permission?: string, requireSuperOnly = false) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const authUser = req.authUser;
    const ip = getClientIp(req);
    if (!authUser) {
      return res.status(401).json({ error: "Authentification requise.", code: "UNAUTHENTICATED" });
    }

    const rateLimit =
      subscriptionStore.getPlatformSettings().securitySettings.adminRateLimitPerMin || 120;
    if (!checkRateLimit(`admin:${authUser.uid}:${ip}`, rateLimit, 60_000)) {
      subscriptionStore.recordAuditLog({
        adminUid: authUser.uid,
        adminEmail: authUser.email || authUser.uid,
        adminRole: authUser.role,
        action: "ADMIN_RATE_LIMITED",
        category: "security",
        outcome: "denied",
        ip,
        detail: `Rate limit dépassé sur ${req.method} ${req.originalUrl}`,
      });
      return res.status(429).json({
        error: "Trop de requêtes administrateur. Patientez quelques secondes.",
        code: "RATE_LIMITED",
      });
    }

    const isAllowedRole = requireSuperOnly
      ? authUser.role === "SUPER_ADMIN"
      : authUser.role === "SUPER_ADMIN" || authUser.role === "ADMIN";

    const hasPerm =
      !permission || subscriptionStore.hasPermission(authUser.role, permission);

    if (!authUser.emailVerified || !isAllowedRole || !hasPerm) {
      subscriptionStore.recordAuditLog({
        adminUid: authUser.uid,
        adminEmail: authUser.email || authUser.uid,
        adminRole: authUser.role,
        action: "UNAUTHORIZED_ADMIN_ACCESS",
        category: "security",
        outcome: "denied",
        ip,
        detail: `Accès refusé (403) sur ${req.method} ${req.originalUrl}`,
      });
      return res.status(403).json({
        error: "Accès refusé : droits Super Admin requis.",
        code: "FORBIDDEN_SUPER_ADMIN_REQUIRED",
      });
    }

    next();
  };
}

function requireRecentReauth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const settings = subscriptionStore.getPlatformSettings();
  if (!settings.securitySettings.requireReauthForCriticalActions) {
    return next();
  }
  const authUser = req.authUser;
  if (!authUser) {
    return res.status(401).json({ error: "Authentification requise." });
  }
  const maxAgeMs = 30 * 60 * 1000; // 30 minutes
  const authAge = Date.now() - authUser.authTimeMs;
  if (authAge > maxAgeMs) {
    return res.status(403).json({
      error:
        "Ré-authentification requise pour cette action critique (session authentifiée depuis plus de 30 minutes).",
      code: "REAUTH_REQUIRED",
    });
  }
  next();
}

function requireFeature(feature: FeatureKey) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const sub = req.userSubscription;
    if (!sub) {
      return res.status(401).json({ error: "Authentification requise.", code: "UNAUTHENTICATED" });
    }
    if (!hasFeatureAccess(sub, feature)) {
      const requiredPlan = getRequiredPlanForFeature(feature);
      const code =
        sub.status === "expired"
          ? "SUBSCRIPTION_EXPIRED"
          : sub.status === "suspended"
          ? "SUBSCRIPTION_SUSPENDED"
          : requiredPlan === "FAMILY"
          ? "FAMILY_REQUIRED"
          : requiredPlan === "BUSINESS"
          ? "BUSINESS_REQUIRED"
          : "PREMIUM_REQUIRED";
      return res.status(403).json({
        error: `Cette fonctionnalité nécessite VruGuard ${requiredPlan}.`,
        code,
        requiredPlan,
        currentPlan: sub.effectivePlan,
        feature,
      });
    }
    next();
  };
}

function requireConsentAccepted(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.authUser) {
    return res.status(401).json({ error: "Authentification requise.", code: "UNAUTHENTICATED" });
  }
  const consent = subscriptionStore.getUserConsentStatus(req.authUser.uid);
  if (!consent.accessAllowed) {
    return res.status(403).json({
      error:
        "L’acceptation des conditions d’utilisation et de la politique de confidentialité VRU Guard Sentinel est requise pour accéder à ce service.",
      code: "CONSENT_REQUIRED",
      consent,
    });
  }
  next();
}

function getStripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

function getPlanAmount(
  plan: SubscriptionPlan,
  billingCycle: BillingCycle,
  currency: SupportedCurrency
): number {
  return subscriptionStore.getPlanAmount(plan, billingCycle, currency);
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(cors());

  // Stripe Webhook MUST receive raw body before express.json()
  app.post(
    "/api/subscriptions/webhook/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const stripe = getStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const sig = req.headers["stripe-signature"];

      if (!stripe || !webhookSecret || !sig) {
        return res.status(400).json({ error: "Stripe webhook non configuré." });
      }

      let event: Stripe.Event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        console.error("Stripe webhook signature verification failed:", (err as Error).message);
        return res.status(400).json({ error: "Signature webhook invalide." });
      }

      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.payment_status === "paid" && session.metadata?.uid && session.metadata?.plan) {
          const uid = session.metadata.uid;
          const plan = session.metadata.plan as SubscriptionPlan;
          const billingCycle = (session.metadata.billingCycle || "monthly") as BillingCycle;
          const metaCurrency = session.metadata?.currency?.toUpperCase();
          const sessionCurrency = session.currency?.toUpperCase();
          const currency: SupportedCurrency =
            metaCurrency === "TND" || sessionCurrency === "TND" ? "TND" : "EUR";
          const country = session.metadata?.country || null;
          const amount = getPlanAmount(plan, billingCycle, currency);
          const updated = subscriptionStore.activateVerifiedSubscription({
            uid,
            plan,
            billingCycle,
            provider: "stripe",
            paymentRef: session.id,
            amount,
            currency,
            country,
          });
          await mirrorSubscriptionToAdminFirestore(updated);
        }
      }

      res.json({ received: true });
    }
  );

  app.use(express.json({ limit: "12mb" }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  const tcpConnections = new Map<WebSocket, net.Socket>();

  wss.on("connection", (ws) => {
    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.type === "connect_teria") {
          const { host, port } = data.payload;
          if (tcpConnections.has(ws)) {
            const existingSocket = tcpConnections.get(ws);
            existingSocket?.destroy();
            tcpConnections.delete(ws);
          }

          const tcpSocket = new net.Socket();
          tcpConnections.set(ws, tcpSocket);

          tcpSocket.connect(port, host, () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "teria_status", status: "connected" }));
            }
          });

          let dataBuffer = "";
          tcpSocket.on("data", (chunk) => {
            dataBuffer += chunk.toString();
            let newlineIdx;
            while ((newlineIdx = dataBuffer.indexOf("\n")) !== -1) {
              const line = dataBuffer.substring(0, newlineIdx).trim();
              dataBuffer = dataBuffer.substring(newlineIdx + 1);
              if (line && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "teria_data", payload: line }));
              }
            }
          });

          tcpSocket.on("error", (err) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "teria_error", error: err.message }));
            }
          });

          tcpSocket.on("close", () => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "teria_status", status: "disconnected" }));
            }
            tcpConnections.delete(ws);
          });
        }

        if (data.type === "disconnect_teria") {
          const socket = tcpConnections.get(ws);
          if (socket) {
            socket.destroy();
            tcpConnections.delete(ws);
          }
          ws.send(JSON.stringify({ type: "teria_status", status: "disconnected" }));
        }
      } catch (err) {
        console.error("WS Message Error", err);
      }
    });

    ws.on("close", () => {
      const socket = tcpConnections.get(ws);
      if (socket) {
        socket.destroy();
        tcpConnections.delete(ws);
      }
    });
  });

  // Health
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Visitor geolocation & default currency resolution
  app.get("/api/pricing/geo", async (req, res) => {
    const geo = await resolveVisitorGeo(req);
    res.json(geo);
  });

  // Public platform configuration (maintenance mode, announcements, regional plan prices, support email, geo currency)
  app.get("/api/platform/public-config", async (req, res) => {
    const geo = await resolveVisitorGeo(req);
    res.json({
      config: subscriptionStore.getPublicPlatformConfig(),
      geo,
    });
  });

  // Authoritative Session Status & RBAC check (handles banned/suspended checks cleanly)
  app.get("/api/auth/session-status", async (req: Request, res: Response) => {
    try {
      const tokenResult = await extractVerifiedToken(req);
      if (!tokenResult) {
        return res.status(401).json({ error: "Authentification requise.", code: "UNAUTHENTICATED" });
      }
      const { decoded, idToken } = tokenResult;
      const authTimeMs = (decoded.auth_time || Math.floor(Date.now() / 1000)) * 1000;
      const email = decoded.email || null;
      const emailVerified = Boolean(decoded.email_verified);
      const createdAtMs = await fetchUserCreatedAtMs(decoded.uid, idToken);

      const dir = subscriptionStore.upsertDirectoryUser({
        uid: decoded.uid,
        email,
        displayName: (decoded as any).name || null,
        photoURL: (decoded as any).picture || null,
        emailVerified,
        createdAt: createdAtMs,
        lastLoginAt: Date.now(),
      });

      const sessionRevoked = Boolean(dir.revokedAfter && authTimeMs < dir.revokedAfter);
      const sub = subscriptionStore.getUserSubscription(decoded.uid, {
        email,
        userCreatedAtMs: createdAtMs,
      });

      const isSuperAdmin = dir.role === "SUPER_ADMIN" && emailVerified;
      const isAdmin = (dir.role === "SUPER_ADMIN" || dir.role === "ADMIN") && emailVerified;

      res.json({
        uid: decoded.uid,
        email,
        emailVerified,
        role: dir.role,
        isSuperAdmin,
        isAdmin,
        accountStatus: dir.accountStatus,
        sessionRevoked,
        restrictionReason:
          dir.accountStatus === "banned"
            ? dir.banReason || "Compte banni par l’administration."
            : dir.accountStatus === "suspended"
            ? dir.suspensionReason || "Compte temporairement suspendu."
            : dir.accountStatus === "soft_deleted"
            ? "Compte désactivé."
            : null,
        suspensionExpiresAt: dir.suspensionExpiresAt || null,
        subscription: sub,
        consent: subscriptionStore.getUserConsentStatus(decoded.uid),
        unreadNotifications:
          dir.accountStatus === "active" && !sessionRevoked
            ? subscriptionStore.getNotificationsForUser(decoded.uid, email, sub.effectivePlan)
            : [],
        publicConfig: subscriptionStore.getPublicPlatformConfig(),
        geo: await resolveVisitorGeo(req),
      });
    } catch {
      return res.status(401).json({ error: "Jeton invalide.", code: "INVALID_TOKEN" });
    }
  });

  // Live Presence Heartbeat & Offline Signal
  app.post("/api/presence/heartbeat", authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
    const { state = "online", lastInteractionAt, sessionId, currentPage } = (req.body || {}) as {
      state?: "online" | "idle";
      lastInteractionAt?: number;
      sessionId?: string;
      currentPage?: string;
    };
    const presence = subscriptionStore.updatePresenceHeartbeat({
      uid: req.authUser!.uid,
      state: state === "idle" ? "idle" : "online",
      lastInteractionAt: typeof lastInteractionAt === "number" ? lastInteractionAt : Date.now(),
      sessionId: typeof sessionId === "string" ? sessionId.slice(0, 64) : undefined,
      currentPage: typeof currentPage === "string" ? currentPage.slice(0, 120) : undefined,
    });
    res.json({ presence });
  });

  app.post("/api/presence/offline", async (req: Request, res: Response) => {
    try {
      let uid: string | null = null;
      const tokenResult = await extractVerifiedToken(req);
      if (tokenResult) {
        uid = tokenResult.decoded.uid;
      } else if (req.body?.idToken) {
        const decoded = await getAuth().verifyIdToken(String(req.body.idToken));
        uid = decoded.uid;
      }
      if (uid) {
        subscriptionStore.markPresenceOffline(uid);
      }
      res.json({ offline: true });
    } catch {
      res.json({ offline: false });
    }
  });

  // User Notifications Feed
  app.get("/api/user/notifications", authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
    const notifications = subscriptionStore.getNotificationsForUser(
      req.authUser!.uid,
      req.authUser!.email,
      req.userSubscription!.effectivePlan
    );
    res.json({ notifications });
  });

  app.post(
    "/api/user/notifications/:id/read",
    authenticateRequest,
    (req: AuthenticatedRequest, res: Response) => {
      const notifId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      subscriptionStore.markNotificationRead(notifId, req.authUser!.uid);
      res.json({ read: true });
    }
  );

  // First Login Consent & RGPD Compliance (Server-Authoritative & Account-Scoped)
  app.get(
    "/api/user/consent-status",
    authenticateRequest,
    (req: AuthenticatedRequest, res: Response) => {
      const consent = subscriptionStore.getUserConsentStatus(req.authUser!.uid);
      res.json({ consent });
    }
  );

  app.post(
    "/api/user/accept-consent",
    authenticateRequest,
    (req: AuthenticatedRequest, res: Response) => {
      const ip = getClientIp(req);
      if (!checkRateLimit(`consent:${req.authUser!.uid}:${ip}`, 30, 5 * 60_000)) {
        return res.status(429).json({
          error: "Trop de requêtes de consentement. Patientez quelques instants.",
        });
      }
      try {
        const body = (req.body || {}) as {
          acceptedRequired?: unknown;
          platform?: unknown;
          consentVersion?: unknown;
          termsVersion?: unknown;
          privacyVersion?: unknown;
          optionalConsents?: {
            notifications?: unknown;
            locationEnhancements?: unknown;
          };
        };

        const platformRaw = typeof body.platform === "string" ? body.platform.toLowerCase().trim() : "";
        if (platformRaw !== "web" && platformRaw !== "android") {
          return res.status(400).json({
            error: "Plateforme invalide (web ou android requis).",
          });
        }

        const result = subscriptionStore.acceptUserConsent({
          uid: req.authUser!.uid,
          email: req.authUser!.email,
          platform: platformRaw as ConsentPlatform,
          consentVersion: typeof body.consentVersion === "string" ? body.consentVersion : undefined,
          termsVersion: typeof body.termsVersion === "string" ? body.termsVersion : undefined,
          privacyVersion: typeof body.privacyVersion === "string" ? body.privacyVersion : undefined,
          acceptedRequired: body.acceptedRequired === true,
          optionalConsents: {
            notifications: body.optionalConsents?.notifications === true,
            locationEnhancements: body.optionalConsents?.locationEnhancements === true,
          },
          ip,
        });

        return res.status(200).json({
          accepted: true,
          alreadyAccepted: result.alreadyAccepted,
          consent: result.statusResponse,
        });
      } catch (err) {
        return res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.post(
    "/api/user/refuse-consent",
    authenticateRequest,
    (req: AuthenticatedRequest, res: Response) => {
      const ip = getClientIp(req);
      try {
        const body = (req.body || {}) as { platform?: unknown };
        const platformRaw = typeof body.platform === "string" ? body.platform.toLowerCase().trim() : "web";
        const platform: ConsentPlatform = platformRaw === "android" ? "android" : "web";

        const consent = subscriptionStore.refuseUserConsent({
          uid: req.authUser!.uid,
          email: req.authUser!.email,
          platform,
          ip,
        });
        return res.status(200).json({
          refused: true,
          consent,
        });
      } catch (err) {
        return res.status(409).json({ error: (err as Error).message });
      }
    }
  );

  app.patch(
    "/api/user/consent-preferences",
    authenticateRequest,
    (req: AuthenticatedRequest, res: Response) => {
      const ip = getClientIp(req);
      try {
        const body = (req.body || {}) as {
          platform?: unknown;
          optionalConsents?: {
            notifications?: boolean;
            locationEnhancements?: boolean;
          };
        };
        const platformRaw = typeof body.platform === "string" ? body.platform.toLowerCase().trim() : "web";
        const platform: ConsentPlatform = platformRaw === "android" ? "android" : "web";

        const consent = subscriptionStore.updateOptionalConsents({
          uid: req.authUser!.uid,
          email: req.authUser!.email,
          platform,
          optionalConsents: body.optionalConsents || {},
          ip,
        });
        return res.status(200).json({ consent });
      } catch (err) {
        return res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.post(
    "/api/user/withdraw-consent",
    authenticateRequest,
    (req: AuthenticatedRequest, res: Response) => {
      const ip = getClientIp(req);
      try {
        const body = (req.body || {}) as { platform?: unknown };
        const platformRaw = typeof body.platform === "string" ? body.platform.toLowerCase().trim() : "web";
        const platform: ConsentPlatform = platformRaw === "android" ? "android" : "web";

        const consent = subscriptionStore.withdrawUserConsent({
          uid: req.authUser!.uid,
          email: req.authUser!.email,
          platform,
          ip,
        });
        return res.status(200).json({ withdrawn: true, consent });
      } catch (err) {
        return res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // Accessibility Program (User Submission & Status)
  app.get("/api/accessibility/me", authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
    const requests = subscriptionStore.listAccessibilityRequests(req.authUser!.uid);
    res.json({ requests });
  });

  app.post(
    "/api/accessibility/apply",
    authenticateRequest,
    requireConsentAccepted,
    (req: AuthenticatedRequest, res: Response) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`acc:${req.authUser!.uid}:${ip}`, 10, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "Trop de tentatives. Réessayez plus tard." });
    }
    try {
      const { fullName, disabilityCategory, description, documentName, documentMimeType, documentBase64 } =
        req.body || {};
      if (!fullName || !disabilityCategory || !description) {
        return res.status(400).json({ error: "Nom complet, situation et description requis." });
      }
      const created = subscriptionStore.submitAccessibilityRequest({
        uid: req.authUser!.uid,
        email: req.authUser!.email,
        displayName: req.authUser!.name,
        fullName: String(fullName),
        disabilityCategory: String(disabilityCategory),
        description: String(description),
        documentName: String(documentName || "justificatif.pdf"),
        documentMimeType: String(documentMimeType || "application/pdf"),
        documentBase64: typeof documentBase64 === "string" ? documentBase64 : undefined,
      });
      res.status(201).json({ request: created });
    } catch (err) {
      res.status(400).json({ error: (err as Error).message });
    }
  });

  // Support Tickets (User Submission & Conversation)
  app.post("/api/support/tickets", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`support:${ip}`, 15, 60 * 60 * 1000)) {
      return res.status(429).json({ error: "Trop de demandes support envoyées. Patientez." });
    }
    const { email, name, subject, category, priority, message } = req.body || {};
    if (!email || !subject || !message) {
      return res.status(400).json({ error: "E-mail, sujet et message requis." });
    }
    let uid: string | null = null;
    try {
      const tokenResult = await extractVerifiedToken(req);
      uid = tokenResult?.decoded.uid || null;
    } catch {
      uid = null;
    }
    const ticket = subscriptionStore.createSupportTicket({
      uid,
      email: String(email),
      name: String(name || email.split("@")[0]),
      subject: String(subject),
      category: category || "support",
      priority: priority || "normal",
      message: String(message),
    });
    res.status(201).json({ ticket });
  });

  app.get("/api/support/my-tickets", authenticateRequest, (req: AuthenticatedRequest, res: Response) => {
    const tickets = subscriptionStore.listSupportTickets(req.authUser!.uid);
    res.json({ tickets });
  });

  app.post(
    "/api/support/my-tickets/:id/reply",
    authenticateRequest,
    (req: AuthenticatedRequest, res: Response) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ticket = subscriptionStore
        .listSupportTickets(req.authUser!.uid)
        .find((t) => t.id === id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket introuvable." });
      }
      const { message } = req.body || {};
      if (!message || !String(message).trim()) {
        return res.status(400).json({ error: "Message requis." });
      }
      const updated = subscriptionStore.replySupportTicket({
        ticketId: id,
        message: String(message),
        senderRole: "user",
        senderEmail: req.authUser!.email || req.authUser!.uid,
      });
      res.json({ ticket: updated });
    }
  );

  // Public subscription plans catalog (synced with regional Platform Settings prices & visitor IP currency)
  app.get("/api/subscriptions/plans", async (req, res) => {
    const geo = await resolveVisitorGeo(req);
    const settings = subscriptionStore.getPlatformSettings();
    const prices = settings.planPrices;
    const regionalPlans = settings.regionalPlans;

    const dynamicPlans = SUBSCRIPTION_PLANS.map((p) => {
      const reg = regionalPlans?.[p.id];
      if (p.id === "PREMIUM") {
        return {
          ...p,
          enabled: reg?.enabled ?? true,
          monthlyPriceTnd: prices.premiumMonthlyTnd,
          annualPriceTnd: prices.premiumAnnualTnd,
          monthlyPriceEur: prices.premiumMonthlyEur,
          annualPriceEur: prices.premiumAnnualEur,
        };
      }
      if (p.id === "FAMILY") {
        return {
          ...p,
          enabled: reg?.enabled ?? true,
          monthlyPriceTnd: prices.familyMonthlyTnd,
          annualPriceTnd: prices.familyAnnualTnd,
          monthlyPriceEur: prices.familyMonthlyEur,
          annualPriceEur: prices.familyAnnualEur,
        };
      }
      return {
        ...p,
        enabled: reg?.enabled ?? true,
      };
    });

    res.json({
      visitorCountry: geo.country,
      currency: geo.currency,
      geoSource: geo.source,
      plans: dynamicPlans,
      regionalPlans,
      paymentProvidersCompatibility: {
        TND: getCompatibleProvidersForCurrency("TND"),
        EUR: getCompatibleProvidersForCurrency("EUR"),
      },
      paymentGatewaysConfigured: {
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
        konnect: Boolean(process.env.KONNECT_API_KEY && process.env.KONNECT_WALLET_ID),
      },
    });
  });

  // Authoritative quote preview (validates plan enabled, server price, currency, and provider compatibility)
  app.post("/api/subscriptions/quote", async (req: Request, res: Response) => {
    try {
      const { plan, billingCycle = "monthly", provider = "stripe", country, currency } = (req.body ||
        {}) as {
        plan?: SubscriptionPlan;
        billingCycle?: BillingCycle;
        provider?: "stripe" | "konnect";
        country?: string | null;
        currency?: string | null;
      };

      if (plan !== "PREMIUM" && plan !== "FAMILY") {
        return res.status(400).json({ error: "Plan payant invalide. Choisissez PREMIUM ou FAMILY." });
      }
      if (billingCycle !== "monthly" && billingCycle !== "annual") {
        return res.status(400).json({ error: "Cycle de facturation invalide." });
      }
      if (!subscriptionStore.isPlanEnabled(plan)) {
        return res.status(403).json({
          code: "PLAN_DISABLED",
          error: `Le plan ${plan} est actuellement désactivé par l’administration.`,
        });
      }

      const geo = await resolveVisitorGeo(req);
      const cleanCountry =
        typeof country === "string" && /^[A-Za-z]{2}$/.test(country.trim())
          ? country.trim().toUpperCase()
          : geo.country;
      const authorizedCurrency: SupportedCurrency =
        currency === "TND" || currency === "EUR"
          ? currency
          : getCurrencyForCountry(cleanCountry);

      if (provider !== "stripe" && provider !== "konnect") {
        return res.status(400).json({ error: "Prestataire de paiement non supporté." });
      }
      if (!isProviderCompatibleWithCurrency(provider, authorizedCurrency)) {
        return res.status(400).json({
          code: "CURRENCY_PROVIDER_INCOMPATIBLE",
          error: `Le prestataire ${provider === "konnect" ? "Konnect" : provider} ne supporte pas la devise ${authorizedCurrency}. Utilisez Stripe pour payer en EUR.`,
          currency: authorizedCurrency,
          allowedProviders: getCompatibleProvidersForCurrency(authorizedCurrency),
        });
      }

      const amount = getPlanAmount(plan, billingCycle, authorizedCurrency);
      return res.json({
        plan,
        billingCycle,
        country: cleanCountry,
        currency: authorizedCurrency,
        amount,
        provider,
        compatible: true,
      });
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message || "Erreur de tarification." });
    }
  });

  // Authoritative subscription state for current user
  app.get("/api/subscriptions/me", authenticateRequest, async (req: AuthenticatedRequest, res: Response) => {
    const sub = req.userSubscription!;
    await mirrorSubscriptionToAdminFirestore(sub);
    res.json({
      subscription: sub,
      paymentGatewaysConfigured: {
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
        konnect: Boolean(process.env.KONNECT_API_KEY && process.env.KONNECT_WALLET_ID),
      },
    });
  });

  // Initiate real payment checkout (Stripe or Konnect) - server authoritatively resolves price & currency
  app.post(
    "/api/subscriptions/checkout",
    authenticateRequest,
    requireConsentAccepted,
    async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        plan,
        billingCycle = "monthly",
        provider = "stripe",
        country,
        currency,
      } = (req.body || {}) as {
        plan: SubscriptionPlan;
        billingCycle?: BillingCycle;
        provider?: "stripe" | "konnect";
        country?: string | null;
        currency?: string | null;
      };

      if (plan !== "PREMIUM" && plan !== "FAMILY") {
        return res.status(400).json({ error: "Plan payant invalide. Choisissez PREMIUM ou FAMILY." });
      }
      if (billingCycle !== "monthly" && billingCycle !== "annual") {
        return res.status(400).json({ error: "Cycle de facturation invalide." });
      }
      if (provider !== "stripe" && provider !== "konnect") {
        return res.status(400).json({ error: "Prestataire de paiement non supporté." });
      }

      if (!subscriptionStore.isPlanEnabled(plan)) {
        return res.status(403).json({
          code: "PLAN_DISABLED",
          error: `La formule ${plan} est actuellement désactivée par l’administration.`,
        });
      }

      const currentSub = req.userSubscription!;
      if (
        plan === "PREMIUM" &&
        currentSub.isEarlyTester &&
        currentSub.earlyTesterEndDate &&
        currentSub.earlyTesterEndDate > Date.now()
      ) {
        return res.status(409).json({
          code: "EARLY_TESTER_ACTIVE",
          error:
            "Votre accès gratuit Pioneer de 2 ans à VruGuard Premium est déjà actif. Aucun paiement n'est requis pendant cette période.",
          earlyTesterEndDate: currentSub.earlyTesterEndDate,
        });
      }

      const geo = await resolveVisitorGeo(req);
      const resolvedCountry =
        typeof country === "string" && /^[A-Za-z]{2}$/.test(country.trim())
          ? country.trim().toUpperCase()
          : geo.country;
      const authorizedCurrency: SupportedCurrency =
        currency === "TND" || currency === "EUR"
          ? currency
          : getCurrencyForCountry(resolvedCountry);

      if (!isProviderCompatibleWithCurrency(provider, authorizedCurrency)) {
        return res.status(400).json({
          code: "CURRENCY_PROVIDER_INCOMPATIBLE",
          error:
            provider === "konnect"
              ? "Konnect accepte uniquement les paiements en TND. Sélectionnez Stripe pour payer en EUR."
              : `Le prestataire ${provider} ne supporte pas la devise ${authorizedCurrency}.`,
          currency: authorizedCurrency,
          allowedProviders: getCompatibleProvidersForCurrency(authorizedCurrency),
        });
      }

      // Server-authoritative regional price lookup (never trust client price)
      const authorizedAmount = getPlanAmount(plan, billingCycle, authorizedCurrency);
      const appUrl = process.env.APP_URL || `${req.protocol}://${req.get("host")}`;

      if (provider === "konnect") {
        if (!process.env.KONNECT_API_KEY || !process.env.KONNECT_WALLET_ID) {
          return res.status(503).json({
            code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
            error:
              "La passerelle Konnect (TND) n'est pas configurée sur le serveur (KONNECT_API_KEY requis). Utilisez un code Redeem officiel.",
            quote: {
              plan,
              billingCycle,
              amount: authorizedAmount,
              currency: authorizedCurrency,
              country: resolvedCountry,
              provider,
            },
          });
        }

        const orderId = `VRU-${req.authUser!.uid.slice(0, 8)}-${Date.now()}`;
        const konnectResp = await fetch("https://api.konnect.network/api/v2/payments/init-payment", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": process.env.KONNECT_API_KEY,
          },
          body: JSON.stringify({
            receiverWalletId: process.env.KONNECT_WALLET_ID,
            token: "TND",
            amount: Math.round(authorizedAmount * 1000),
            type: "immediate",
            description: `VruGuard ${plan} (${billingCycle})`,
            acceptedPaymentMethods: ["wallet", "bank_card", "e-DINAR"],
            orderId,
            successUrl: `${appUrl}/?view=pricing&provider=konnect&orderId=${encodeURIComponent(orderId)}`,
            failUrl: `${appUrl}/?view=pricing&payment_status=failed`,
            email: req.authUser!.email || undefined,
          }),
        });

        const konnectData = await konnectResp.json();
        if (!konnectResp.ok || !konnectData?.payUrl || !konnectData?.paymentRef) {
          return res.status(502).json({
            error: "Erreur lors de l'initialisation du paiement Konnect.",
            details: konnectData,
          });
        }

        subscriptionStore.createPendingTransaction({
          uid: req.authUser!.uid,
          plan,
          billingCycle,
          amount: authorizedAmount,
          currency: "TND",
          country: resolvedCountry || "TN",
          provider: "konnect",
          providerSessionId: konnectData.paymentRef,
        });

        return res.json({
          checkoutUrl: konnectData.payUrl,
          sessionId: konnectData.paymentRef,
          provider: "konnect",
          amount: authorizedAmount,
          currency: "TND",
          country: resolvedCountry || "TN",
        });
      }

      const stripe = getStripeClient();
      if (stripe) {
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          customer_email: req.authUser!.email || undefined,
          line_items: [
            {
              price_data: {
                currency: authorizedCurrency.toLowerCase(),
                product_data: {
                  name: `VruGuard ${plan} (${billingCycle === "annual" ? "Annuel" : "Mensuel"})`,
                  description:
                    plan === "PREMIUM"
                      ? "SOS, contacts d'urgence, alertes automatiques et protection avancée"
                      : "Protection familiale multi-profils jusqu'à 6 membres + Premium complet",
                },
                unit_amount: toStripeUnitAmount(authorizedAmount, authorizedCurrency),
              },
              quantity: 1,
            },
          ],
          metadata: {
            uid: req.authUser!.uid,
            plan,
            billingCycle,
            currency: authorizedCurrency,
            country: resolvedCountry || "",
          },
          success_url: `${appUrl}/?view=pricing&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/?view=pricing&payment_status=cancelled`,
        });

        subscriptionStore.createPendingTransaction({
          uid: req.authUser!.uid,
          plan,
          billingCycle,
          amount: authorizedAmount,
          currency: authorizedCurrency,
          country: resolvedCountry,
          provider: "stripe",
          providerSessionId: session.id,
        });

        return res.json({
          checkoutUrl: session.url,
          sessionId: session.id,
          provider: "stripe",
          amount: authorizedAmount,
          currency: authorizedCurrency,
          country: resolvedCountry,
        });
      }

      return res.status(503).json({
        code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
        error:
          "Aucune passerelle de paiement n'est configurée sur le serveur (STRIPE_SECRET_KEY ou KONNECT_API_KEY requis). Utilisez un code Redeem officiel.",
        quote: {
          plan,
          billingCycle,
          amount: authorizedAmount,
          currency: authorizedCurrency,
          country: resolvedCountry,
          provider,
        },
      });
    } catch (err) {
      console.error("Checkout error:", err);
      return res.status(500).json({ error: (err as Error).message || "Erreur serveur checkout." });
    }
  });

  app.post(
    "/api/subscriptions/verify-payment",
    authenticateRequest,
    requireConsentAccepted,
    async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { provider, sessionId, paymentRef } = req.body as {
        provider: "stripe" | "konnect";
        sessionId?: string;
        paymentRef?: string;
      };

      if (provider === "stripe") {
        const stripe = getStripeClient();
        if (!stripe || !sessionId) {
          return res.status(400).json({ error: "Stripe non configuré ou sessionId manquant." });
        }
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.metadata?.uid !== req.authUser!.uid) {
          return res.status(403).json({ error: "Cette session de paiement n'appartient pas à cet utilisateur." });
        }
        if (session.payment_status !== "paid") {
          return res.status(402).json({ error: "Paiement non confirmé par Stripe.", status: session.payment_status });
        }
        const plan = (session.metadata?.plan || "PREMIUM") as SubscriptionPlan;
        const billingCycle = (session.metadata?.billingCycle || "monthly") as BillingCycle;
        const metaCurrency = session.metadata?.currency?.toUpperCase();
        const sessionCurrency = session.currency?.toUpperCase();
        const currency: SupportedCurrency =
          metaCurrency === "TND" || sessionCurrency === "TND" ? "TND" : "EUR";
        const country = session.metadata?.country || null;
        const tx = subscriptionStore.findTransactionByProviderSession(session.id);
        const amount = tx?.amount ?? getPlanAmount(plan, billingCycle, currency);

        const updated = subscriptionStore.activateVerifiedSubscription({
          uid: req.authUser!.uid,
          plan,
          billingCycle,
          provider: "stripe",
          paymentRef: session.id,
          amount,
          currency,
          country,
        });
        await mirrorSubscriptionToAdminFirestore(updated);
        return res.json({ verified: true, subscription: updated });
      }

      if (provider === "konnect") {
        const ref = paymentRef || sessionId;
        if (!process.env.KONNECT_API_KEY || !ref) {
          return res.status(400).json({ error: "Konnect non configuré ou référence manquante." });
        }
        const tx = subscriptionStore.findTransactionByProviderSession(ref);
        if (!tx || tx.uid !== req.authUser!.uid) {
          return res.status(403).json({ error: "Transaction introuvable pour cet utilisateur." });
        }
        const konnectResp = await fetch(`https://api.konnect.network/api/v2/payments/${encodeURIComponent(ref)}`, {
          headers: { "x-api-key": process.env.KONNECT_API_KEY },
        });
        const konnectData = await konnectResp.json();
        const paymentStatus = konnectData?.payment?.status;
        if (!konnectResp.ok || paymentStatus !== "completed") {
          return res.status(402).json({ error: "Paiement non confirmé par Konnect.", status: paymentStatus });
        }
        const updated = subscriptionStore.activateVerifiedSubscription({
          uid: req.authUser!.uid,
          plan: tx.plan,
          billingCycle: tx.billingCycle,
          provider: "konnect",
          paymentRef: ref,
          amount: tx.amount,
          currency: "TND",
          country: tx.country || "TN",
        });
        await mirrorSubscriptionToAdminFirestore(updated);
        return res.json({ verified: true, subscription: updated });
      }

      return res.status(400).json({ error: "Fournisseur de paiement non supporté." });
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post("/api/subscriptions/cancel", authenticateRequest, async (req: AuthenticatedRequest, res: Response) => {
    const updated = subscriptionStore.scheduleCancellation(req.authUser!.uid);
    await mirrorSubscriptionToAdminFirestore(updated);
    res.json({ subscription: updated });
  });

  // Activate paid subscription via Admin-issued Redeem Code (rate-limited + atomic)
  app.post(
    "/api/subscriptions/redeem",
    authenticateRequest,
    requireConsentAccepted,
    async (req: AuthenticatedRequest, res: Response) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`redeem:${req.authUser!.uid}:${ip}`, 15, 5 * 60_000)) {
      return res.status(429).json({ error: "Trop de tentatives de code Redeem. Patientez 5 minutes." });
    }
    try {
      const { code, expectedPlan } = (req.body || {}) as {
        code?: string;
        expectedPlan?: "PREMIUM" | "FAMILY" | "BUSINESS";
      };
      if (!code || typeof code !== "string" || !code.trim()) {
        return res.status(400).json({ error: "Veuillez saisir un code Redeem valide." });
      }
      if (expectedPlan && expectedPlan !== "PREMIUM" && expectedPlan !== "FAMILY" && expectedPlan !== "BUSINESS") {
        return res.status(400).json({ error: "Formule cible invalide." });
      }
      const result = subscriptionStore.redeemCodeForUser({
        uid: req.authUser!.uid,
        email: req.authUser!.email || null,
        code,
        expectedPlan,
      });
      await mirrorSubscriptionToAdminFirestore(result.subscription);
      return res.json({
        activated: true,
        subscription: result.subscription,
        activation: result.activation,
        plan: result.codeRecord.plan,
        billingCycle: result.codeRecord.billingCycle,
        durationDays: result.codeRecord.durationDays,
      });
    } catch (err) {
      return res.status(400).json({ error: (err as Error).message || "Activation Redeem impossible." });
    }
  });

  // Business Quote Submission
  app.post("/api/business/quote", async (req: Request, res: Response) => {
    const { companyName, contactName, email, phone, teamSize, vehicleCount, needsApi, message } = req.body || {};
    if (!companyName || !contactName || !email) {
      return res.status(400).json({ error: "Nom d'entreprise, contact et e-mail requis." });
    }

    let uid: string | null = null;
    try {
      const tokenResult = await extractVerifiedToken(req);
      uid = tokenResult?.decoded.uid || null;
    } catch {
      uid = null;
    }

    const quote = subscriptionStore.createBusinessQuote({
      uid,
      companyName: String(companyName).slice(0, 150),
      contactName: String(contactName).slice(0, 120),
      email: String(email).slice(0, 200),
      phone: String(phone || "").slice(0, 50),
      teamSize: String(teamSize || "1-10").slice(0, 50),
      vehicleCount: String(vehicleCount || "0").slice(0, 50),
      needsApi: Boolean(needsApi),
      message: String(message || "").slice(0, 2000),
    });

    res.status(201).json({ quote });
  });

  // Protected SOS & Emergency Contacts authorization endpoints
  app.post(
    "/api/sos/authorize",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("sos"),
    (req: AuthenticatedRequest, res: Response) => {
      res.json({
        authorized: true,
        effectivePlan: req.userSubscription!.effectivePlan,
        timestamp: Date.now(),
      });
    }
  );

  app.post(
    "/api/sos/settings-authorize",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("sos"),
    (req: AuthenticatedRequest, res: Response) => {
      res.json({ authorized: true, effectivePlan: req.userSubscription!.effectivePlan });
    }
  );

  app.post(
    "/api/contacts/authorize",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("emergency_contacts"),
    (req: AuthenticatedRequest, res: Response) => {
      res.json({
        authorized: true,
        maxEmergencyContacts: req.userSubscription!.entitlements.maxEmergencyContacts,
      });
    }
  );

  // Protected Family Profiles & Member Settings API (FAMILY+)
  app.get(
    "/api/family/profiles",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("family_dashboard"),
    (req: AuthenticatedRequest, res: Response) => {
      const profiles = subscriptionStore.getFamilyProfiles(req.authUser!.uid);
      res.json({
        profiles,
        maxFamilyMembers: req.userSubscription!.entitlements.maxFamilyMembers,
      });
    }
  );

  app.post(
    "/api/family/profiles",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("family_management"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const { name, relation, vruType, emergencyContactPhone, shareLocation, sosAlertsEnabled, geofenceAlertEnabled, speedAlertThresholdKmh } = req.body || {};
        if (!name || typeof name !== "string" || !name.trim()) {
          return res.status(400).json({ error: "Le nom du membre est requis." });
        }
        const profile = subscriptionStore.addFamilyProfile(
          req.authUser!.uid,
          {
            name,
            relation: relation || "child",
            vruType,
            emergencyContactPhone,
            shareLocation,
            sosAlertsEnabled,
            geofenceAlertEnabled,
            speedAlertThresholdKmh,
          },
          req.userSubscription!.entitlements.maxFamilyMembers
        );
        res.status(201).json({ profile });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.patch(
    "/api/family/profiles/:id",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("family_member_settings"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const profileId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const updated = subscriptionStore.updateFamilyProfile(req.authUser!.uid, profileId, req.body || {});
        res.json({ profile: updated });
      } catch (err) {
        res.status(404).json({ error: (err as Error).message });
      }
    }
  );

  app.delete(
    "/api/family/profiles/:id",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("family_management"),
    (req: AuthenticatedRequest, res: Response) => {
      const profileId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      subscriptionStore.removeFamilyProfile(req.authUser!.uid, profileId);
      res.json({ deleted: true });
    }
  );

  // =========================================================================
  // SUPER ADMIN API (/api/super-admin/*) — Server-Enforced Zero-Trust RBAC
  // =========================================================================

  // Record unauthorized UI route attempts on /super-admin
  app.post("/api/super-admin/audit-denied", async (req: Request, res: Response) => {
    const ip = getClientIp(req);
    let uid = "anonymous";
    let email = "anonymous";
    try {
      const tokenResult = await extractVerifiedToken(req);
      if (tokenResult) {
        uid = tokenResult.decoded.uid;
        email = tokenResult.decoded.email || uid;
      }
    } catch {
      // anonymous or invalid token
    }
    subscriptionStore.recordAuditLog({
      adminUid: uid,
      adminEmail: email,
      adminRole: "USER",
      action: "UNAUTHORIZED_SUPER_ADMIN_ROUTE",
      category: "security",
      outcome: "denied",
      ip,
      detail: `Tentative d'accès direct à /super-admin par ${email}`,
    });
    res.status(403).json({ error: "Accès refusé.", code: "FORBIDDEN_SUPER_ADMIN_REQUIRED" });
  });

  // 1. Overview & Live Analytics
  app.get(
    "/api/super-admin/overview",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    async (req: AuthenticatedRequest, res: Response) => {
      const fsUsers = await fetchMergedUsersFromFirestore(req.authUser!.idToken);
      const analytics = subscriptionStore.getOverviewAnalytics(fsUsers);
      const recentActivations = subscriptionStore.listRecentActivationsForAdmin(30);
      res.json({
        ...analytics,
        recentActivations,
        serverCapabilities: { hasAdminIam },
      });
    }
  );

  // 2. User Management & Presence Monitoring
  app.get(
    "/api/super-admin/users",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    async (req: AuthenticatedRequest, res: Response) => {
      const fsUsers = await fetchMergedUsersFromFirestore(req.authUser!.idToken);
      let users = subscriptionStore.listAllUsersSummary(fsUsers);

      const search = String(req.query.search || "").trim().toLowerCase();
      const planFilter = String(req.query.plan || "ALL");
      const accountStatusFilter = String(req.query.accountStatus || "ALL");
      const presenceFilter = String(req.query.presence || "ALL");
      const sortBy = String(req.query.sortBy || "createdAt");
      const sortDir = String(req.query.sortDir || "desc") === "asc" ? 1 : -1;

      if (search) {
        users = users.filter(
          (u) =>
            u.uid.toLowerCase().includes(search) ||
            (u.email || "").toLowerCase().includes(search) ||
            (u.displayName || "").toLowerCase().includes(search)
        );
      }
      if (planFilter !== "ALL") {
        users = users.filter((u) => u.subscription.effectivePlan === planFilter);
      }
      if (accountStatusFilter !== "ALL") {
        users = users.filter((u) => u.accountStatus === accountStatusFilter);
      }
      if (presenceFilter !== "ALL") {
        users = users.filter((u) => u.presence.state === presenceFilter);
      }

      users.sort((a, b) => {
        if (sortBy === "lastLoginAt") {
          return ((a.lastLoginAt || 0) - (b.lastLoginAt || 0)) * sortDir;
        }
        if (sortBy === "email") {
          return (a.email || "").localeCompare(b.email || "") * sortDir;
        }
        if (sortBy === "plan") {
          return a.subscription.effectivePlan.localeCompare(b.subscription.effectivePlan) * sortDir;
        }
        return ((a.createdAt || 0) - (b.createdAt || 0)) * sortDir;
      });

      const page = Math.max(1, Number(req.query.page) || 1);
      const pageSize = Math.min(100, Math.max(5, Number(req.query.pageSize) || 20));
      const total = users.length;
      const items = users.slice((page - 1) * pageSize, page * pageSize);

      res.json({
        users: items,
        total,
        page,
        pageSize,
        presenceSummary: subscriptionStore.listPresenceSummary(),
      });
    }
  );

  app.get(
    "/api/super-admin/users/:uid",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    async (req: AuthenticatedRequest, res: Response) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      const fsUsers = await fetchMergedUsersFromFirestore(req.authUser!.idToken);
      const all = subscriptionStore.listAllUsersSummary(fsUsers);
      const user = all.find((u) => u.uid === targetUid);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur introuvable." });
      }
      const accessibilityRequests = subscriptionStore.listAccessibilityRequests(targetUid);
      const supportTickets = subscriptionStore.listSupportTickets(targetUid);
      const familyProfiles = subscriptionStore.getFamilyProfiles(targetUid);
      const auditLogs = subscriptionStore
        .listAuditLogs({ limit: 100 })
        .filter((l) => l.targetUid === targetUid);

      res.json({
        user,
        accessibilityRequests,
        supportTickets,
        familyProfilesCount: familyProfiles.length,
        auditLogs,
      });
    }
  );

  // 3. Account Governance Actions (Suspend, Ban, Unban, Revoke Sessions, Soft/Hard Delete)
  app.post(
    "/api/super-admin/users/:uid/suspend",
    authenticateRequest,
    requireSuperAdminPermission("users:suspend"),
    async (req: AuthenticatedRequest, res: Response) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      if (targetUid === req.authUser!.uid) {
        return res.status(400).json({ error: "Impossible de suspendre votre propre compte Super Admin." });
      }
      const { reason, durationHours = 24 } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: "Un motif de suspension est obligatoire." });
      }
      const updated = subscriptionStore.suspendUser({
        targetUid,
        reason: String(reason),
        durationHours: Number(durationHours) || 24,
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      if (hasAdminIam) {
        await getAuth().revokeRefreshTokens(targetUid).catch(() => {});
      }
      res.json({ user: updated });
    }
  );

  app.post(
    "/api/super-admin/users/:uid/ban",
    authenticateRequest,
    requireSuperAdminPermission("users:ban", true),
    requireRecentReauth,
    async (req: AuthenticatedRequest, res: Response) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      if (targetUid === req.authUser!.uid) {
        return res.status(400).json({ error: "Impossible de bannir votre propre compte Super Admin." });
      }
      const { reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: "Un motif de bannissement est obligatoire." });
      }
      const updated = subscriptionStore.banUser({
        targetUid,
        reason: String(reason),
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      if (hasAdminIam) {
        await getAuth().updateUser(targetUid, { disabled: true }).catch(() => {});
        await getAuth().revokeRefreshTokens(targetUid).catch(() => {});
      }
      res.json({ user: updated });
    }
  );

  app.post(
    "/api/super-admin/users/:uid/unban",
    authenticateRequest,
    requireSuperAdminPermission("users:ban", true),
    async (req: AuthenticatedRequest, res: Response) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      const { reason } = req.body || {};
      const updated = subscriptionStore.unbanOrReactivateUser({
        targetUid,
        reason: reason ? String(reason) : undefined,
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      if (hasAdminIam) {
        await getAuth().updateUser(targetUid, { disabled: false }).catch(() => {});
      }
      res.json({ user: updated });
    }
  );

  app.post(
    "/api/super-admin/users/:uid/revoke-sessions",
    authenticateRequest,
    requireSuperAdminPermission("security:write", true),
    async (req: AuthenticatedRequest, res: Response) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      const { reason } = req.body || {};
      const updated = subscriptionStore.revokeUserSessions({
        targetUid,
        reason: reason ? String(reason) : undefined,
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      if (hasAdminIam) {
        await getAuth().revokeRefreshTokens(targetUid).catch(() => {});
      }
      res.json({ user: updated });
    }
  );

  app.post(
    "/api/super-admin/users/:uid/soft-delete",
    authenticateRequest,
    requireSuperAdminPermission("users:delete", true),
    async (req: AuthenticatedRequest, res: Response) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      if (targetUid === req.authUser!.uid) {
        return res.status(400).json({ error: "Impossible de supprimer votre propre compte Super Admin." });
      }
      const { reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: "Un motif est obligatoire." });
      }
      const updated = subscriptionStore.softDeleteUser({
        targetUid,
        reason: String(reason),
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      if (hasAdminIam) {
        await getAuth().updateUser(targetUid, { disabled: true }).catch(() => {});
        await getAuth().revokeRefreshTokens(targetUid).catch(() => {});
      }
      res.json({ user: updated });
    }
  );

  app.delete(
    "/api/super-admin/users/:uid",
    authenticateRequest,
    requireSuperAdminPermission("users:delete", true),
    requireRecentReauth,
    async (req: AuthenticatedRequest, res: Response) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      if (targetUid === req.authUser!.uid) {
        return res.status(400).json({ error: "Impossible de supprimer votre propre compte Super Admin." });
      }
      const { confirmPhrase, reason } = req.body || {};
      if (confirmPhrase !== "SUPPRIMER DEFINITIVEMENT") {
        return res.status(400).json({
          error: "Confirmation explicite requise : saisissez exactement SUPPRIMER DEFINITIVEMENT.",
        });
      }
      const result = subscriptionStore.hardDeleteUser({
        targetUid,
        reason: String(reason || "Suppression définitive par Super Admin"),
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      if (hasAdminIam) {
        await getAuth().deleteUser(targetUid).catch(() => {});
        if (adminFirestore) {
          await adminFirestore.collection("users").doc(targetUid).delete().catch(() => {});
          await adminFirestore.collection("public_profiles").doc(targetUid).delete().catch(() => {});
          await adminFirestore.collection("subscriptions").doc(targetUid).delete().catch(() => {});
        }
      }
      res.json({ deleted: true, ...result });
    }
  );

  // 4. Subscription Administration
  app.post(
    "/api/super-admin/users/:uid/subscription",
    authenticateRequest,
    requireSuperAdminPermission("subscriptions:write"),
    async (req: AuthenticatedRequest, res: Response) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      const {
        action,
        plan,
        billingCycle,
        durationDays,
        startDate,
        endDate,
        isLifetime,
        reason,
        activationType,
        targetEmail,
      } = (req.body || {}) as {
        action?: "assign" | "extend" | "suspend" | "reactivate" | "grant_lifetime" | "downgrade_free";
        plan?: SubscriptionPlan;
        billingCycle?: BillingCycle;
        durationDays?: number | null;
        startDate?: number;
        endDate?: number | null;
        isLifetime?: boolean;
        reason?: string;
        activationType?: ActivationSource;
        targetEmail?: string | null;
      };

      if (!action) {
        return res.status(400).json({ error: "Action abonnement requise." });
      }
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: "Un motif administratif est obligatoire." });
      }

      const updated = subscriptionStore.adminUpdateUserSubscription({
        targetUid,
        targetEmail,
        action,
        plan,
        billingCycle,
        durationDays,
        startDate,
        endDate,
        isLifetime,
        reason: String(reason),
        activationType: activationType || "admin",
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      await mirrorSubscriptionToAdminFirestore(updated);
      res.json({ subscription: updated });
    }
  );

  // 5. Redeem Codes (Super Admin full suite with masked listing & CSV export)
  app.get(
    "/api/super-admin/redeem-codes",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req: AuthenticatedRequest, res: Response) => {
      const codes = subscriptionStore.listRedeemCodesForAdmin();
      res.json({
        codes,
        stats: subscriptionStore.getAdminOverviewStats(),
      });
    }
  );

  app.post(
    "/api/super-admin/redeem-codes",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req: AuthenticatedRequest, res: Response) => {
      const {
        plan = "PREMIUM",
        durationCode = "1m",
        billingCycle,
        count = 1,
        maxUses = 1,
        expiresAt = null,
        campaign,
        note,
      } = (req.body || {}) as {
        plan?: "PREMIUM" | "FAMILY" | "BUSINESS";
        durationCode?: RedeemDurationCode;
        billingCycle?: BillingCycle;
        count?: number;
        maxUses?: number;
        expiresAt?: number | null;
        campaign?: string;
        note?: string;
      };

      if (plan !== "PREMIUM" && plan !== "FAMILY" && plan !== "BUSINESS") {
        return res.status(400).json({ error: "Plan invalide (PREMIUM, FAMILY ou BUSINESS)." });
      }
      const allowedDurations: RedeemDurationCode[] = ["1m", "3m", "6m", "12m", "24m", "lifetime"];
      if (!allowedDurations.includes(durationCode)) {
        return res.status(400).json({ error: "Durée invalide." });
      }

      const created = subscriptionStore.generateRedeemCodes({
        plan,
        durationCode,
        billingCycle,
        count: Number(count) || 1,
        maxUses: Number(maxUses) || 1,
        expiresAt: expiresAt ? Number(expiresAt) : null,
        campaign,
        note,
        createdBy: req.authUser!.email || req.authUser!.uid,
        adminUid: req.authUser!.uid,
        ip: getClientIp(req),
      });

      res.status(201).json({
        generatedCodes: created,
        maskedCodes: subscriptionStore.listRedeemCodesForAdmin(),
        stats: subscriptionStore.getAdminOverviewStats(),
      });
    }
  );

  app.post(
    "/api/super-admin/redeem-codes/:id/revoke",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const code = subscriptionStore.updateRedeemCodeStatus({
          idOrCode: id,
          action: "revoke",
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
          ip: getClientIp(req),
        });
        res.json({ code, stats: subscriptionStore.getAdminOverviewStats() });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.post(
    "/api/super-admin/redeem-codes/:id/disable",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const code = subscriptionStore.updateRedeemCodeStatus({
          idOrCode: id,
          action: "disable",
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
          ip: getClientIp(req),
        });
        res.json({ code, stats: subscriptionStore.getAdminOverviewStats() });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.post(
    "/api/super-admin/redeem-codes/:id/enable",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const code = subscriptionStore.updateRedeemCodeStatus({
          idOrCode: id,
          action: "enable",
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
          ip: getClientIp(req),
        });
        res.json({ code, stats: subscriptionStore.getAdminOverviewStats() });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.get(
    "/api/super-admin/redeem-codes/export-csv",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req: AuthenticatedRequest, res: Response) => {
      const codes = subscriptionStore.listRedeemCodesForAdmin();
      const header = "id,maskedCode,plan,durationCode,status,usesCount,maxUses,campaign,createdBy,createdAt,expiresAt,usedByEmail\n";
      const rows = codes
        .map((c) =>
          [
            c.id || "",
            c.maskedCode || c.code,
            c.plan,
            c.durationCode || c.billingCycle,
            c.status,
            c.usesCount ?? 0,
            c.maxUses ?? 1,
            JSON.stringify(c.campaign || ""),
            JSON.stringify(c.createdBy || ""),
            new Date(c.createdAt).toISOString(),
            c.expiresAt ? new Date(c.expiresAt).toISOString() : "",
            JSON.stringify(c.usedByEmail || ""),
          ].join(",")
        )
        .join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="vruguard-redeem-codes-${Date.now()}.csv"`);
      res.send(header + rows);
    }
  );

  // 6. Accessibility Program Administration
  app.get(
    "/api/super-admin/accessibility",
    authenticateRequest,
    requireSuperAdminPermission("accessibility:review"),
    (req: AuthenticatedRequest, res: Response) => {
      const requests = subscriptionStore.listAccessibilityRequests();
      res.json({ requests });
    }
  );

  app.get(
    "/api/super-admin/accessibility/:id/document",
    authenticateRequest,
    requireSuperAdminPermission("accessibility:review"),
    (req: AuthenticatedRequest, res: Response) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const docFile = subscriptionStore.getAccessibilityDocumentFile(id);
      if (!docFile) {
        return res.status(404).json({ error: "Document justificatif introuvable." });
      }
      res.setHeader("Content-Type", docFile.mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename="${docFile.fileName.replace(/"/g, "")}"`
      );
      fs.createReadStream(docFile.filePath).pipe(res);
    }
  );

  app.post(
    "/api/super-admin/accessibility/:id/decision",
    authenticateRequest,
    requireSuperAdminPermission("accessibility:review"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { decision, comment } = (req.body || {}) as {
          decision?: "approved" | "rejected" | "more_info_required";
          comment?: string;
        };
        if (
          decision !== "approved" &&
          decision !== "rejected" &&
          decision !== "more_info_required"
        ) {
          return res.status(400).json({ error: "Décision invalide." });
        }
        const result = subscriptionStore.reviewAccessibilityRequest({
          requestId: id,
          decision,
          comment,
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
          ip: getClientIp(req),
        });
        if (result.subscription) {
          await mirrorSubscriptionToAdminFirestore(result.subscription);
        }
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // 7. Pioneer / Early Tester Program Administration
  app.get(
    "/api/super-admin/pioneer",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    async (req: AuthenticatedRequest, res: Response) => {
      const fsUsers = await fetchMergedUsersFromFirestore(req.authUser!.idToken);
      subscriptionStore.listAllUsersSummary(fsUsers);
      res.json(subscriptionStore.listPioneerData());
    }
  );

  app.post(
    "/api/super-admin/pioneer/grant",
    authenticateRequest,
    requireSuperAdminPermission("pioneer:write", true),
    async (req: AuthenticatedRequest, res: Response) => {
      const { uid, email, durationDays, note } = req.body || {};
      if (!uid && !email) {
        return res.status(400).json({ error: "uid ou email requis." });
      }
      const updated = subscriptionStore.grantEarlyTester({
        uid,
        email,
        durationDays: durationDays ? Number(durationDays) : undefined,
        note,
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      if (updated) await mirrorSubscriptionToAdminFirestore(updated);
      res.json({ granted: true, subscription: updated, ...subscriptionStore.listPioneerData() });
    }
  );

  app.post(
    "/api/super-admin/pioneer/revoke",
    authenticateRequest,
    requireSuperAdminPermission("pioneer:write", true),
    (req: AuthenticatedRequest, res: Response) => {
      const { uid, email, reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: "Motif requis." });
      }
      subscriptionStore.revokePioneerAccess({
        uid,
        email,
        reason: String(reason),
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      res.json({ revoked: true, ...subscriptionStore.listPioneerData() });
    }
  );

  // 8. Immutable Audit Logs
  app.get(
    "/api/super-admin/audit-logs",
    authenticateRequest,
    requireSuperAdminPermission("audit:read"),
    (req: AuthenticatedRequest, res: Response) => {
      const logs = subscriptionStore.listAuditLogs({
        category: String(req.query.category || "ALL"),
        outcome: String(req.query.outcome || "ALL"),
        search: String(req.query.search || ""),
        limit: Number(req.query.limit) || 250,
      });
      res.json({ logs });
    }
  );

  // 9. Platform Settings & Regional Pricing History
  app.get(
    "/api/super-admin/settings",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    (req: AuthenticatedRequest, res: Response) => {
      res.json({
        settings: subscriptionStore.getPlatformSettings(),
        priceHistory: subscriptionStore.getPriceChangeHistory(150),
      });
    }
  );

  app.put(
    "/api/super-admin/settings",
    authenticateRequest,
    requireSuperAdminPermission("settings:write", true),
    requireRecentReauth,
    (req: AuthenticatedRequest, res: Response) => {
      const settings = subscriptionStore.updatePlatformSettings({
        updates: req.body || {},
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      res.json({
        settings,
        priceHistory: subscriptionStore.getPriceChangeHistory(150),
      });
    }
  );

  app.get(
    "/api/super-admin/pricing",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    (req: AuthenticatedRequest, res: Response) => {
      const settings = subscriptionStore.getPlatformSettings();
      res.json({
        planPrices: settings.planPrices,
        regionalPlans: settings.regionalPlans,
        priceHistory: subscriptionStore.getPriceChangeHistory(200),
      });
    }
  );

  app.put(
    "/api/super-admin/pricing",
    authenticateRequest,
    requireSuperAdminPermission("settings:write", true),
    requireRecentReauth,
    (req: AuthenticatedRequest, res: Response) => {
      const settings = subscriptionStore.updatePlatformSettings({
        updates: req.body || {},
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      res.json({
        settings,
        planPrices: settings.planPrices,
        regionalPlans: settings.regionalPlans,
        priceHistory: subscriptionStore.getPriceChangeHistory(200),
      });
    }
  );

  // 10. Administrative Notifications
  app.get(
    "/api/super-admin/notifications",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    (req: AuthenticatedRequest, res: Response) => {
      res.json({ notifications: subscriptionStore.listAdminNotificationsForAdmin() });
    }
  );

  app.post(
    "/api/super-admin/notifications",
    authenticateRequest,
    requireSuperAdminPermission("notifications:send", true),
    (req: AuthenticatedRequest, res: Response) => {
      const { title, message, type = "info", targetScope = "all", targetUid, targetEmail } =
        req.body || {};
      if (!title || !message) {
        return res.status(400).json({ error: "Titre et message requis." });
      }
      const notification = subscriptionStore.createAdminNotification({
        title: String(title),
        message: String(message),
        type,
        targetScope,
        targetUid: targetUid || null,
        targetEmail: targetEmail || null,
        createdBy: req.authUser!.email || req.authUser!.uid,
        adminUid: req.authUser!.uid,
        ip: getClientIp(req),
      });
      res.status(201).json({ notification });
    }
  );

  // 11. Support, Feedback & Business Quotes
  app.get(
    "/api/super-admin/support",
    authenticateRequest,
    requireSuperAdminPermission("support:write"),
    async (req: AuthenticatedRequest, res: Response) => {
      const [feedbacks, incidents] = await Promise.all([
        fetchFirestoreCollectionWithToken("app_feedback", req.authUser!.idToken),
        fetchFirestoreCollectionWithToken("incidents", req.authUser!.idToken),
      ]);
      res.json({
        tickets: subscriptionStore.listSupportTickets(),
        businessQuotes: subscriptionStore.listBusinessQuotesForAdmin(),
        feedbacks,
        incidentsCount: incidents.length,
        incidents: incidents.slice(0, 50),
      });
    }
  );

  app.post(
    "/api/super-admin/support/:id/reply",
    authenticateRequest,
    requireSuperAdminPermission("support:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { message } = req.body || {};
        if (!message || !String(message).trim()) {
          return res.status(400).json({ error: "Message de réponse requis." });
        }
        const ticket = subscriptionStore.replySupportTicket({
          ticketId: id,
          message: String(message),
          senderRole: "admin",
          senderEmail: req.authUser!.email || req.authUser!.uid,
          adminUid: req.authUser!.uid,
          ip: getClientIp(req),
        });
        res.json({ ticket });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.patch(
    "/api/super-admin/support/:id",
    authenticateRequest,
    requireSuperAdminPermission("support:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { status, priority } = req.body as {
          status: SupportTicketStatus;
          priority?: "low" | "normal" | "high" | "urgent";
        };
        const ticket = subscriptionStore.updateSupportTicketStatus({
          ticketId: id,
          status,
          priority,
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
          ip: getClientIp(req),
        });
        res.json({ ticket });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.post(
    "/api/super-admin/support/:id/notes",
    authenticateRequest,
    requireSuperAdminPermission("support:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { note } = req.body || {};
        if (!note || !String(note).trim()) {
          return res.status(400).json({ error: "Note interne requise." });
        }
        const ticket = subscriptionStore.addSupportInternalNote({
          ticketId: id,
          note: String(note),
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
        });
        res.json({ ticket });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  app.patch(
    "/api/super-admin/business-quotes/:id",
    authenticateRequest,
    requireSuperAdminPermission("support:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { status, internalNote } = req.body || {};
        const quote = subscriptionStore.updateBusinessQuote({
          id,
          status,
          internalNote,
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
        });
        res.json({ quote });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // 12. Security Overview
  app.get(
    "/api/super-admin/security",
    authenticateRequest,
    requireSuperAdminPermission("audit:read", true),
    (req: AuthenticatedRequest, res: Response) => {
      const settings = subscriptionStore.getPlatformSettings();
      const securityEvents = subscriptionStore
        .listAuditLogs({ category: "security", limit: 100 });
      res.json({
        securitySettings: settings.securitySettings,
        recentSecurityEvents: securityEvents,
        hasAdminIam,
        currentAdmin: {
          uid: req.authUser!.uid,
          email: req.authUser!.email,
          role: req.authUser!.role,
          authTimeMs: req.authUser!.authTimeMs,
        },
      });
    }
  );

  // =========================================================================
  // 13. Android APK Public Distribution, Update Check & Private Admin Manager
  // =========================================================================

  const apkMulterStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
      if (!fs.existsSync(APK_TMP_DIR)) {
        fs.mkdirSync(APK_TMP_DIR, { recursive: true });
      }
      cb(null, APK_TMP_DIR);
    },
    filename: (_req, file, cb) => {
      const rand = crypto.randomBytes(6).toString("hex");
      cb(null, `upload_${Date.now()}_${rand}_${sanitizeApkFileName(file.originalname)}`);
    },
  });

  const handleApkDownloadStream = async (
    req: Request,
    res: Response,
    releaseId: string,
    allowUnpublished: boolean,
    source: "web" | "android_app" | "qr" | "admin"
  ) => {
    try {
      const bin = await subscriptionStore.getAndroidReleaseBinaryForDownload(
        releaseId,
        allowUnpublished
      );
      if (!bin) {
        return res.status(404).json({
          error: "Application Android actuellement indisponible ou version non publiée.",
          code: "APK_NOT_AVAILABLE",
        });
      }

      const geo = await resolveVisitorGeo(req);
      const rangeHeader = req.headers.range;
      const totalSize = bin.fileSize;

      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${bin.fileName.replace(/"/g, "")}"`
      );
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "no-store, max-age=0");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("X-Checksum-Sha256", bin.sha256);
      res.setHeader("ETag", `"${bin.sha256}"`);

      if (rangeHeader && /^bytes=\d*-\d*$/.test(rangeHeader.trim())) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parts[0] ? parseInt(parts[0], 10) : 0;
        const end = parts[1] ? Math.min(parseInt(parts[1], 10), totalSize - 1) : totalSize - 1;
        if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= totalSize) {
          res.setHeader("Content-Range", `bytes */${totalSize}`);
          return res.status(416).end();
        }
        const chunkSize = end - start + 1;
        let eventId: string | null = null;
        if (start === 0) {
          const evt = subscriptionStore.recordAndroidDownloadInitiated({
            releaseId: bin.release.id,
            source,
            bytesTotal: totalSize,
            country: geo.country,
          });
          eventId = evt?.id || null;
          if (eventId) res.setHeader("X-Download-Event-Id", eventId);
        }

        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
        res.setHeader("Content-Length", String(chunkSize));

        let bytesSent = 0;
        let aborted = false;
        const stream = fs.createReadStream(bin.filePath, { start, end });
        stream.on("data", (chunk) => {
          bytesSent += chunk.length;
        });
        req.on("close", () => {
          if (!res.writableEnded) {
            aborted = true;
            stream.destroy();
            if (eventId) {
              subscriptionStore.markAndroidDownloadFinished(eventId, bytesSent, "aborted");
            }
          }
        });
        res.on("finish", () => {
          if (eventId && !aborted && end >= totalSize - 1 && bytesSent >= chunkSize) {
            subscriptionStore.markAndroidDownloadFinished(eventId, totalSize, "completed");
          }
        });
        stream.on("error", () => {
          if (eventId) {
            subscriptionStore.markAndroidDownloadFinished(eventId, bytesSent, "aborted");
          }
          if (!res.headersSent) res.status(500).end();
          else res.end();
        });
        return stream.pipe(res);
      }

      const evt = subscriptionStore.recordAndroidDownloadInitiated({
        releaseId: bin.release.id,
        source,
        bytesTotal: totalSize,
        country: geo.country,
      });
      if (evt) {
        res.setHeader("X-Download-Event-Id", evt.id);
      }
      res.setHeader("Content-Length", String(totalSize));

      let bytesSent = 0;
      let aborted = false;
      const stream = fs.createReadStream(bin.filePath);
      stream.on("data", (chunk) => {
        bytesSent += chunk.length;
      });
      req.on("close", () => {
        if (!res.writableEnded && evt) {
          aborted = true;
          stream.destroy();
          subscriptionStore.markAndroidDownloadFinished(evt.id, bytesSent, "aborted");
        }
      });
      res.on("finish", () => {
        if (evt && !aborted && bytesSent >= totalSize) {
          subscriptionStore.markAndroidDownloadFinished(evt.id, bytesSent, "completed");
        }
      });
      stream.on("error", () => {
        if (evt) {
          subscriptionStore.markAndroidDownloadFinished(evt.id, bytesSent, "aborted");
        }
        if (!res.headersSent) res.status(500).end();
        else res.end();
      });
      return stream.pipe(res);
    } catch (err) {
      return res.status(500).json({ error: (err as Error).message });
    }
  };

  // Public API: Check latest published Android version & mandatory/optional update status
  app.get("/api/android-app/latest", (req: Request, res: Response) => {
    const rawCode = req.query.currentVersionCode || req.headers["x-app-version-code"];
    const installedVersionCode = rawCode ? Number(rawCode) : null;
    const latestInfo = subscriptionStore.getLatestPublicAndroidInfo(
      installedVersionCode && Number.isFinite(installedVersionCode) ? installedVersionCode : null
    );
    res.json(latestInfo);
  });

  // Public API: Download latest published APK
  app.get("/api/android-app/download/latest", async (req: Request, res: Response) => {
    const latest = subscriptionStore.getCurrentPublishedAndroidRelease();
    if (!latest || !subscriptionStore.getAndroidAppSettings().downloadsEnabled) {
      return res.status(404).json({
        error: "Aucune version Android n’est actuellement disponible au téléchargement.",
        code: "APK_NOT_AVAILABLE",
      });
    }
    const rawSource = String(req.query.source || "web");
    const source: "web" | "android_app" | "qr" =
      rawSource === "android_app" || rawSource === "qr" ? rawSource : "web";
    return handleApkDownloadStream(req, res, latest.id, false, source);
  });

  // Public API: Download specific published APK by release ID (never serves drafts or disabled)
  app.get("/api/android-app/download/:id", async (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rawSource = String(req.query.source || "web");
    const source: "web" | "android_app" | "qr" =
      rawSource === "android_app" || rawSource === "qr" ? rawSource : "web";
    return handleApkDownloadStream(req, res, id, false, source);
  });

  // Public API: Explicit download completion confirmation beacon
  app.post("/api/android-app/downloads/:eventId/confirm", (req: Request, res: Response) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`apk-confirm:${ip}`, 30, 60_000)) {
      return res.status(429).json({ error: "Trop de requêtes." });
    }
    const eventId = Array.isArray(req.params.eventId)
      ? req.params.eventId[0]
      : req.params.eventId;
    const bytesSent = Number(req.body?.bytesSent || 0);
    const updated = subscriptionStore.markAndroidDownloadFinished(
      eventId,
      Number.isFinite(bytesSent) ? bytesSent : 0,
      "completed"
    );
    if (!updated) {
      return res.status(404).json({ error: "Événement introuvable." });
    }
    return res.json({ confirmed: true, event: updated });
  });

  // Super Admin API: List releases, settings & download statistics
  app.get(
    "/api/super-admin/android-app/releases",
    authenticateRequest,
    requireSuperAdminPermission("android:read"),
    (_req: AuthenticatedRequest, res: Response) => {
      res.json({
        releases: subscriptionStore.listAndroidReleases(),
        settings: subscriptionStore.getAndroidAppSettings(),
        stats: subscriptionStore.getAndroidDownloadStats(),
        currentRelease: subscriptionStore.getCurrentPublishedAndroidRelease(),
      });
    }
  );

  // Super Admin API: Upload new APK file + metadata (multipart/form-data)
  app.post(
    "/api/super-admin/android-app/releases",
    authenticateRequest,
    requireSuperAdminPermission("android:write"),
    (req: AuthenticatedRequest, res: Response) => {
      const settings = subscriptionStore.getAndroidAppSettings();
      const uploadMiddleware = multer({
        storage: apkMulterStorage,
        limits: {
          fileSize: settings.maxApkSizeBytes || 200 * 1024 * 1024,
          files: 1,
        },
        fileFilter: (_r, file, cb) => {
          const clean = path.basename(file.originalname || "").toLowerCase();
          if (!clean.endsWith(".apk")) {
            cb(new Error("Seuls les fichiers d'application Android (.apk) sont autorisés."));
            return;
          }
          cb(null, true);
        },
      }).single("apk");

      uploadMiddleware(req, res, async (uploadErr: any) => {
        const uploadedFile = (req as Request & { file?: Express.Multer.File }).file;
        const cleanupTemp = () => {
          if (uploadedFile?.path && fs.existsSync(uploadedFile.path)) {
            try {
              fs.unlinkSync(uploadedFile.path);
            } catch {
              // ignore
            }
          }
        };

        if (uploadErr) {
          cleanupTemp();
          const msg =
            uploadErr.code === "LIMIT_FILE_SIZE"
              ? `Fichier trop volumineux (limite maximale : ${Math.round(
                  settings.maxApkSizeBytes / (1024 * 1024)
                )} Mo).`
              : uploadErr.message || "Erreur lors de l'upload du fichier APK.";
          return res.status(400).json({ error: msg });
        }

        if (!uploadedFile) {
          return res.status(400).json({ error: "Veuillez sélectionner un fichier .apk à uploader." });
        }

        try {
          const inspection = await validateAndInspectApkFile({
            filePath: uploadedFile.path,
            originalName: uploadedFile.originalname,
            mimeType: uploadedFile.mimetype,
            maxSizeBytes: settings.maxApkSizeBytes,
            storageDir: APK_TMP_DIR,
          });

          if (!inspection.valid) {
            cleanupTemp();
            subscriptionStore.recordAuditLog({
              adminUid: req.authUser!.uid,
              adminEmail: req.authUser!.email || req.authUser!.uid,
              adminRole: req.authUser!.role,
              action: "ANDROID_APK_UPLOAD_REJECTED",
              category: "android_app",
              outcome: "failed",
              ip: getClientIp(req),
              detail: `Upload APK rejeté (${uploadedFile.originalname}): ${inspection.error}`,
            });
            return res.status(400).json({ error: inspection.error || "Fichier APK invalide." });
          }

          const body = req.body || {};
          const rawWhatsNew = String(body.whatsNew || "");
          let whatsNewList: string[] = [];
          try {
            const parsedArr = JSON.parse(rawWhatsNew);
            if (Array.isArray(parsedArr)) {
              whatsNewList = parsedArr.map((x) => String(x));
            } else {
              whatsNewList = rawWhatsNew.split(/\r?\n/);
            }
          } catch {
            whatsNewList = rawWhatsNew.split(/\r?\n/);
          }

          const statusRaw = String(body.status || "published");
          const status: AndroidReleaseStatus =
            statusRaw === "draft" || statusRaw === "disabled" ? statusRaw : "published";
          const updateTypeRaw = String(body.updateType || "optional");
          const updateType: AndroidUpdateType =
            updateTypeRaw === "mandatory" ? "mandatory" : "optional";
          const setAsCurrent =
            body.setAsCurrent === true ||
            body.setAsCurrent === "true" ||
            body.setAsCurrent === "1";

          const created = subscriptionStore.createAndroidRelease({
            tempFilePath: uploadedFile.path,
            originalFileName: uploadedFile.originalname,
            fileSize: inspection.fileSize,
            sha256: inspection.sha256,
            mimeType: uploadedFile.mimetype,
            appName: String(body.appName || settings.appName || "VruGuard"),
            packageName: String(body.packageName || settings.packageName || "com.vruguard.sentinel"),
            versionName: String(body.versionName || ""),
            versionCode: Number(body.versionCode),
            description: String(body.description || ""),
            whatsNew: whatsNewList,
            releaseDate: String(body.releaseDate || new Date().toISOString().slice(0, 10)),
            status,
            minAndroidVersion: String(body.minAndroidVersion || "Android 8.0 (API 26)"),
            minAndroidApi: Number(body.minAndroidApi || 26),
            updateType,
            minSupportedVersionCode: body.minSupportedVersionCode
              ? Number(body.minSupportedVersionCode)
              : null,
            setAsCurrent,
            adminUid: req.authUser!.uid,
            adminEmail: req.authUser!.email || req.authUser!.uid,
            ip: getClientIp(req),
          });

          return res.status(201).json({
            release: created,
            stats: subscriptionStore.getAndroidDownloadStats(),
            currentRelease: subscriptionStore.getCurrentPublishedAndroidRelease(),
          });
        } catch (err) {
          cleanupTemp();
          return res.status(400).json({ error: (err as Error).message });
        }
      });
    }
  );

  // Super Admin API: Update release descriptive metadata
  app.patch(
    "/api/super-admin/android-app/releases/:id",
    authenticateRequest,
    requireSuperAdminPermission("android:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const body = req.body || {};
        const whatsNew = Array.isArray(body.whatsNew)
          ? body.whatsNew.map((s: any) => String(s))
          : typeof body.whatsNew === "string"
          ? body.whatsNew.split(/\r?\n/)
          : undefined;
        const release = subscriptionStore.updateAndroidReleaseMetadata({
          id,
          updates: {
            appName: body.appName,
            versionName: body.versionName,
            description: body.description,
            whatsNew,
            releaseDate: body.releaseDate,
            minAndroidVersion: body.minAndroidVersion,
            minAndroidApi:
              body.minAndroidApi !== undefined ? Number(body.minAndroidApi) : undefined,
            updateType: body.updateType,
            minSupportedVersionCode:
              body.minSupportedVersionCode !== undefined
                ? body.minSupportedVersionCode === null || body.minSupportedVersionCode === ""
                  ? null
                  : Number(body.minSupportedVersionCode)
                : undefined,
          },
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
          ip: getClientIp(req),
        });
        res.json({
          release,
          currentRelease: subscriptionStore.getCurrentPublishedAndroidRelease(),
        });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // Super Admin API: Publish / unpublish / disable / restore a version
  app.post(
    "/api/super-admin/android-app/releases/:id/status",
    authenticateRequest,
    requireSuperAdminPermission("android:write"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const action = req.body?.action;
        if (
          action !== "publish" &&
          action !== "unpublish" &&
          action !== "disable" &&
          action !== "restore"
        ) {
          return res.status(400).json({ error: "Action de statut invalide." });
        }
        const release = await subscriptionStore.setAndroidReleaseStatus({
          id,
          action,
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
          ip: getClientIp(req),
        });
        res.json({
          release,
          releases: subscriptionStore.listAndroidReleases(),
          currentRelease: subscriptionStore.getCurrentPublishedAndroidRelease(),
          stats: subscriptionStore.getAndroidDownloadStats(),
        });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // Super Admin API: Download any APK release (including draft/disabled for QA)
  app.get(
    "/api/super-admin/android-app/releases/:id/download",
    authenticateRequest,
    requireSuperAdminPermission("android:read"),
    async (req: AuthenticatedRequest, res: Response) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      return handleApkDownloadStream(req, res, id, true, "admin");
    }
  );

  // Super Admin API: Delete an older/non-active APK release with retention & active protection
  app.delete(
    "/api/super-admin/android-app/releases/:id",
    authenticateRequest,
    requireSuperAdminPermission("android:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const confirmRetentionOverride =
          req.query.force === "true" || req.body?.confirmRetentionOverride === true;
        subscriptionStore.deleteAndroidRelease({
          id,
          confirmRetentionOverride,
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
          ip: getClientIp(req),
        });
        res.json({
          deleted: true,
          releases: subscriptionStore.listAndroidReleases(),
          stats: subscriptionStore.getAndroidDownloadStats(),
        });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // Super Admin API: Update global Android distribution settings
  app.put(
    "/api/super-admin/android-app/settings",
    authenticateRequest,
    requireSuperAdminPermission("android:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const settings = subscriptionStore.updateAndroidAppSettings({
          updates: req.body || {},
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
          ip: getClientIp(req),
        });
        res.json({ settings });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // Super Admin API: Read-Only First Login Consents Monitoring (Admins NEVER accept on behalf of users)
  app.get(
    "/api/super-admin/consents",
    authenticateRequest,
    requireSuperAdminPermission("consent:read"),
    async (req: AuthenticatedRequest, res: Response) => {
      const fsUsers = await fetchMergedUsersFromFirestore(req.authUser!.idToken);
      const overview = subscriptionStore.getAdminConsentsOverview({
        externalFirestoreUsers: fsUsers,
        statusFilter: String(req.query.status || "ALL"),
        platformFilter: String(req.query.platform || "ALL"),
        search: String(req.query.search || ""),
      });
      res.json(overview);
    }
  );

  app.get(
    "/api/super-admin/consents/:uid",
    authenticateRequest,
    requireSuperAdminPermission("consent:read"),
    (req: AuthenticatedRequest, res: Response) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      const detail = subscriptionStore.getAdminUserConsentDetail(targetUid);
      res.json(detail);
    }
  );

  // Legacy Admin Subscription, Redeem Codes & Early Tester endpoints (strictly server-verified RBAC)
  app.get(
    "/api/admin/subscriptions",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    (req: AuthenticatedRequest, res: Response) => {
      res.json({
        subscriptions: subscriptionStore.listAllSubscriptionsForAdmin(),
        businessQuotes: subscriptionStore.listBusinessQuotesForAdmin(),
        redeemCodes: subscriptionStore.listRedeemCodesForAdmin(),
        activations: subscriptionStore.listRecentActivationsForAdmin(100),
        stats: subscriptionStore.getAdminOverviewStats(),
      });
    }
  );

  app.post(
    "/api/admin/early-tester",
    authenticateRequest,
    requireSuperAdminPermission("pioneer:write", true),
    async (req: AuthenticatedRequest, res: Response) => {
      const { uid, email, note } = req.body || {};
      if (!uid && !email) {
        return res.status(400).json({ error: "uid ou email requis." });
      }
      const updated = subscriptionStore.grantEarlyTester({
        uid,
        email,
        note,
        adminUid: req.authUser!.uid,
        adminEmail: req.authUser!.email || req.authUser!.uid,
        ip: getClientIp(req),
      });
      if (updated) await mirrorSubscriptionToAdminFirestore(updated);
      res.json({ granted: true, subscription: updated });
    }
  );

  app.post(
    "/api/admin/redeem-codes",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req: AuthenticatedRequest, res: Response) => {
      const { plan, billingCycle = "monthly", count = 1, note } = (req.body || {}) as {
        plan?: "PREMIUM" | "FAMILY";
        billingCycle?: "monthly" | "annual";
        count?: number;
        note?: string;
      };
      if (plan !== "PREMIUM" && plan !== "FAMILY") {
        return res.status(400).json({ error: "Le plan doit être PREMIUM ou FAMILY." });
      }
      if (billingCycle !== "monthly" && billingCycle !== "annual") {
        return res.status(400).json({ error: "Cycle invalide (monthly ou annual)." });
      }
      const codes = subscriptionStore.generateRedeemCodes({
        plan,
        billingCycle,
        count: Number(count) || 1,
        createdBy: req.authUser!.email || req.authUser!.uid,
        adminUid: req.authUser!.uid,
        note,
        ip: getClientIp(req),
      });
      res.status(201).json({
        codes,
        stats: subscriptionStore.getAdminOverviewStats(),
      });
    }
  );

  app.post(
    "/api/admin/redeem-codes/:code/revoke",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req: AuthenticatedRequest, res: Response) => {
      try {
        const rawCode = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
        const code = subscriptionStore.updateRedeemCodeStatus({
          idOrCode: rawCode,
          action: "revoke",
          adminUid: req.authUser!.uid,
          adminEmail: req.authUser!.email || req.authUser!.uid,
          ip: getClientIp(req),
        });
        res.json({
          revoked: true,
          code,
          stats: subscriptionStore.getAdminOverviewStats(),
        });
      } catch (err) {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  );

  // Premium-gated AI endpoint
  app.post(
    "/api/ai/generate",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("smart_localization"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const { prompt, schema } = req.body;
        const { GoogleGenAI } = await import("@google/genai");

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
        }

        const ai = new GoogleGenAI({ apiKey });

        const config: Record<string, unknown> = {};
        if (schema) {
          config.responseMimeType = "application/json";
          config.responseSchema = schema;
        }

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
          config,
        });

        res.json({ text: response.text });
      } catch (e: unknown) {
        const err = e as { message?: string };
        if (err.message?.includes("API key not valid")) {
          console.warn("AI Proxy Warning: Invalid API Key provided.");
          return res.status(401).json({ error: "Invalid API key." });
        }
        console.warn("AI Proxy Error:", err.message);
        res.status(500).json({ error: err.message || "Failed to generate content" });
      }
    }
  );

  // =========================================================================
  // Global Incident & Risk Heatmap Endpoints (Strictly Premium-gated)
  // =========================================================================
  app.post(
    "/api/heatmap/query",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("global_risk_heatmap"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body || {};
        if (
          !body.bounds?.northEast ||
          !body.bounds?.southWest ||
          typeof body.bounds.northEast.lat !== "number" ||
          typeof body.bounds.southWest.lat !== "number"
        ) {
          return res.status(400).json({ error: "Paramètres d'emprise géographique (bounds) invalides." });
        }

        const result = await queryHeatmap(
          {
            bounds: body.bounds,
            zoom: Number(body.zoom) || 13,
            categories: Array.isArray(body.categories) ? body.categories : [],
            period: body.period || "24h",
            customStartAt: body.customStartAt ?? null,
            customEndAt: body.customEndAt ?? null,
            severities: Array.isArray(body.severities) ? body.severities : [],
            sources: Array.isArray(body.sources) ? body.sources : [],
            zoneFilter: body.zoneFilter,
            compareOffset: body.compareOffset || "none",
            compareStartAt: body.compareStartAt ?? null,
            compareEndAt: body.compareEndAt ?? null,
          },
          (collectionName) =>
            fetchFirestoreCollectionWithToken(collectionName, req.authUser!.idToken)
        );

        res.json(result);
      } catch (err: unknown) {
        console.warn("Heatmap query error:", (err as Error).message);
        res.status(500).json({ error: (err as Error).message || "Erreur lors du calcul de la heatmap." });
      }
    }
  );

  app.post(
    "/api/heatmap/zone-detail",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("global_risk_heatmap"),
    async (req: AuthenticatedRequest, res: Response) => {
      try {
        const body = req.body || {};
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return res.status(400).json({ error: "Coordonnées lat/lng requises." });
        }

        const detail = await inspectHeatmapZone({
          lat,
          lng,
          zoom: Number(body.zoom) || 13,
          radiusMeters: Number(body.radiusMeters) || 450,
          categories: Array.isArray(body.categories) ? body.categories : [],
          period: body.period || "24h",
          customStartAt: body.customStartAt ?? null,
          customEndAt: body.customEndAt ?? null,
          severities: Array.isArray(body.severities) ? body.severities : [],
          sources: Array.isArray(body.sources) ? body.sources : [],
          compareOffset: body.compareOffset || "none",
          compareStartAt: body.compareStartAt ?? null,
          compareEndAt: body.compareEndAt ?? null,
        });

        res.json(detail);
      } catch (err: unknown) {
        res.status(500).json({ error: (err as Error).message || "Erreur lors de l'inspection de zone." });
      }
    }
  );

  app.get(
    "/api/heatmap/preferences",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("global_risk_heatmap"),
    (req: AuthenticatedRequest, res: Response) => {
      const prefs = heatmapStore.getPreferences(req.authUser!.uid);
      res.json({ preferences: prefs });
    }
  );

  app.put(
    "/api/heatmap/preferences",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("global_risk_heatmap"),
    (req: AuthenticatedRequest, res: Response) => {
      const updated = heatmapStore.savePreferences(req.authUser!.uid, req.body || {});
      res.json({ preferences: updated });
    }
  );

  app.post(
    "/api/heatmap/official-alert",
    authenticateRequest,
    requireSuperAdminPermission("settings:write"),
    (req: AuthenticatedRequest, res: Response) => {
      const { lat, lng, title, description, severityScore = 72, expiresHours = 48 } = req.body || {};
      const nLat = Number(lat);
      const nLng = Number(lng);
      if (!Number.isFinite(nLat) || !Number.isFinite(nLng) || !title) {
        return res.status(400).json({ error: "lat, lng et title requis." });
      }
      const now = Date.now();
      const score = Math.max(10, Math.min(100, Number(severityScore) || 72));
      const gh = `${nLat.toFixed(4)}_${nLng.toFixed(4)}`;
      const ingested = heatmapStore.ingestEvents([
        {
          id: `official_admin_${now}`,
          dedupKey: `${gh}:EXTERNAL_ALERT:OFFICIAL_LOCAL`,
          geohash: gh,
          lat: nLat,
          lng: nLng,
          category: "EXTERNAL_ALERT",
          subType: "OFFICIAL_MUNICIPAL_ALERT",
          title: String(title),
          description: String(description || "Alerte officielle publiée par l'administration VruGuard."),
          source: "OFFICIAL_ALERT",
          sourceLabel: "Alerte Officielle Locale",
          severityScore: score,
          severityTier: severityTierFromScore(score),
          reliability: 0.98,
          confirmations: 1,
          natureWeight: 1.1,
          collectedAt: now,
          lastUpdatedAt: now,
          expiresAt: now + Math.max(1, Number(expiresHours) || 48) * 3600 * 1000,
          status: "active",
        },
      ]);
      res.status(201).json({ created: true, event: ingested[0] });
    }
  );

  app.post("/api/overpass", async (req, res) => {
    try {
      const response = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        headers: {
          "User-Agent": "vru-guard-pmr/1.0",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: "data=" + encodeURIComponent(req.body.query || req.body.data),
      });
      if (!response.ok) {
        return res.status(response.status).send(await response.text());
      }
      const data = await response.json();
      res.json(data);
    } catch (e: unknown) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
