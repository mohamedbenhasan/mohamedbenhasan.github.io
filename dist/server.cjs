var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server.ts
var server_exports = {};
module.exports = __toCommonJS(server_exports);
var import_express = __toESM(require("express"), 1);
var import_path4 = __toESM(require("path"), 1);
var import_fs4 = __toESM(require("fs"), 1);
var import_crypto3 = __toESM(require("crypto"), 1);
var import_multer = __toESM(require("multer"), 1);
var import_vite = require("vite");
var import_http = __toESM(require("http"), 1);
var import_net = __toESM(require("net"), 1);
var import_ws = require("ws");
var import_cors = __toESM(require("cors"), 1);
var import_app = require("firebase-admin/app");
var import_auth = require("firebase-admin/auth");
var import_firestore = require("firebase-admin/firestore");
var import_stripe = __toESM(require("stripe"), 1);

// server/subscriptionStore.ts
var import_fs2 = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_crypto2 = __toESM(require("crypto"), 1);

// utils/subscriptionPlans.ts
var EARLY_TESTER_ROLLOUT_MS = Date.parse("2026-11-18T10:30:00.000Z");
var EARLY_TESTER_DURATION_MS = 2 * 365 * 24 * 60 * 60 * 1e3;
var MONTH_DURATION_MS = 30 * 24 * 60 * 60 * 1e3;
var YEAR_DURATION_MS = 365 * 24 * 60 * 60 * 1e3;
var SUBSCRIPTION_PLANS = [
  {
    id: "FREE",
    name: "Free",
    tagline: "Acc\xE8s essentiel \xE0 la carte et \xE0 la navigation urbaine.",
    monthlyPriceTnd: 0,
    annualPriceTnd: 0,
    monthlyPriceEur: 0,
    annualPriceEur: 0,
    ctaLabel: "Plan de base",
    featuresIncluded: [
      "Cr\xE9ation et gestion du compte utilisateur",
      "Localisation GPS de base",
      "Acc\xE8s complet \xE0 la carte interactive",
      "Navigation de base (itin\xE9raire standard)",
      "Consultation des informations et incidents routiers"
    ],
    featuresExcluded: [
      "Bouton et alertes SOS",
      "Ajout et gestion des contacts d\u2019urgence",
      "Alertes automatiques aux contacts d\u2019urgence",
      "Partage de localisation en temps r\xE9el",
      "Historique avanc\xE9 des \xE9v\xE9nements de s\xE9curit\xE9",
      "Fonctionnalit\xE9s intelligentes Premium"
    ]
  },
  {
    id: "PREMIUM",
    name: "Premium",
    tagline: "Protection active compl\xE8te, SOS, contacts d\u2019urgence et intelligence temps r\xE9el.",
    monthlyPriceTnd: 4.9,
    annualPriceTnd: 49,
    monthlyPriceEur: 3.9,
    annualPriceEur: 39,
    recommended: true,
    badge: "Recommand\xE9",
    ctaLabel: "Passer \xE0 Premium",
    featuresIncluded: [
      "Toutes les fonctionnalit\xE9s Free incluses",
      "Fonction SOS compl\xE8te (bouton urgence, cat\xE9gories & commande vocale)",
      "Contacts d\u2019urgence multiples (jusqu\u2019\xE0 10 contacts)",
      "Alertes automatiques aux contacts d\u2019urgence (Email, SMS, Appel)",
      "Partage de localisation en temps r\xE9el s\xE9curis\xE9",
      "Historique d\xE9taill\xE9 des \xE9v\xE9nements de s\xE9curit\xE9 & exports CSV/PDF",
      "Localisation intelligente & suivi multi-capteurs (TERIA / RTK)",
      "Navigation intelligente s\xE9curis\xE9e, mode PMR & guidage audio",
      "Alertes personnalis\xE9es (Smart Conditions m\xE9t\xE9o & console V2X)",
      "Statistiques avanc\xE9es & analyse IA de s\xE9curit\xE9",
      "Global Incident & Risk Heatmap multi-sources & historique"
    ]
  },
  {
    id: "FAMILY",
    name: "Family",
    tagline: "Protection centralis\xE9e pour toute la famille avec suivi et alertes partag\xE9es.",
    monthlyPriceTnd: 9.9,
    annualPriceTnd: 99,
    monthlyPriceEur: 7.9,
    annualPriceEur: 79,
    ctaLabel: "Choisir Family",
    featuresIncluded: [
      "Toutes les fonctionnalit\xE9s Premium incluses",
      "Profils multiples dans la famille (jusqu\u2019\xE0 6 membres)",
      "Gestion centralis\xE9e des membres de la famille",
      "Partage de localisation entre membres autoris\xE9s",
      "Contacts d\u2019urgence familiaux partag\xE9s",
      "Alertes de s\xE9curit\xE9 d\xE9di\xE9es pour les membres de la famille",
      "Tableau de bord familial unifi\xE9 & suivi parental",
      "Gestion des param\xE8tres de s\xE9curit\xE9 de chaque membre"
    ]
  },
  {
    id: "BUSINESS",
    name: "Business",
    tagline: "Supervision de flotte, \xE9quipes terrain, analytics d\xE9di\xE9s et API entreprise.",
    monthlyPriceTnd: null,
    annualPriceTnd: null,
    monthlyPriceEur: null,
    annualPriceEur: null,
    priceLabelCustom: "Tarif personnalis\xE9",
    ctaLabel: "Demander un devis",
    featuresIncluded: [
      "Gestion d\u2019\xE9quipes et de v\xE9hicules",
      "Tableau de bord professionnel multi-op\xE9rateurs",
      "Suivi et gestion centralis\xE9e des utilisateurs",
      "Statistiques, audits et rapports d\xE9di\xE9s",
      "Gestion avanc\xE9e des alertes de s\xE9curit\xE9",
      "API professionnelle et int\xE9grations SI / V2X",
      "Support entreprise prioritaire et SLA d\xE9di\xE9"
    ]
  }
];
function getEntitlementsForPlan(plan) {
  const isPaidPremiumOrHigher = plan === "PREMIUM" || plan === "FAMILY" || plan === "BUSINESS";
  const isFamilyOrHigher = plan === "FAMILY" || plan === "BUSINESS";
  const isBusiness = plan === "BUSINESS";
  return {
    canUseSos: isPaidPremiumOrHigher,
    canManageEmergencyContacts: isPaidPremiumOrHigher,
    maxEmergencyContacts: isBusiness ? 999 : isPaidPremiumOrHigher ? 10 : 0,
    canUseAutoAlerts: isPaidPremiumOrHigher,
    canShareLiveLocation: isPaidPremiumOrHigher,
    canViewSafetyHistory: isPaidPremiumOrHigher,
    canUseSmartLocalization: isPaidPremiumOrHigher,
    canUseSmartNavigation: isPaidPremiumOrHigher,
    canUseCustomAlerts: isPaidPremiumOrHigher,
    canUseAdvancedStats: isPaidPremiumOrHigher,
    canViewRiskHeatmap: isPaidPremiumOrHigher,
    canUseFamilyDashboard: isFamilyOrHigher,
    maxFamilyMembers: isBusiness ? 999 : plan === "FAMILY" ? 6 : 1,
    canManageFamilySettings: isFamilyOrHigher,
    canUseBusinessFeatures: isBusiness
  };
}
function resolveDurationDaysForRedeem(durationCode) {
  switch (durationCode) {
    case "1m":
      return 30;
    case "3m":
      return 90;
    case "6m":
      return 180;
    case "12m":
      return 365;
    case "24m":
      return 730;
    case "lifetime":
      return null;
    default:
      return 30;
  }
}
function resolveEffectiveSubscription(raw, nowMs = Date.now()) {
  const basePlan = raw.plan || "FREE";
  const startDate = raw.startDate || nowMs;
  const isLifetime = Boolean(raw.isLifetime || raw.isAccessibilityLifetime);
  const endDate = isLifetime ? null : raw.endDate ?? null;
  const isEarlyTester = Boolean(raw.isEarlyTester);
  const earlyTesterStartDate = raw.earlyTesterStartDate ?? (isEarlyTester ? startDate : null);
  const earlyTesterEndDate = raw.earlyTesterEndDate ?? (isEarlyTester && earlyTesterStartDate ? earlyTesterStartDate + EARLY_TESTER_DURATION_MS : null);
  const isSuspended = raw.status === "suspended";
  const earlyTesterActive = !isSuspended && isEarlyTester && earlyTesterEndDate !== null && earlyTesterEndDate > nowMs;
  const accessibilityActive = !isSuspended && Boolean(raw.isAccessibilityLifetime);
  const paidActive = !isSuspended && basePlan !== "FREE" && raw.status === "active" && Boolean(
    raw.paymentVerified || raw.paymentProvider === "admin" || raw.paymentProvider === "redeem" || raw.paymentProvider === "accessibility"
  ) && (isLifetime || (basePlan === "BUSINESS" ? endDate === null || endDate > nowMs : endDate !== null && endDate > nowMs));
  let effectivePlan = "FREE";
  let status = raw.status || "active";
  if (isSuspended) {
    effectivePlan = "FREE";
    status = "suspended";
  } else if (paidActive) {
    effectivePlan = basePlan;
    status = "active";
  } else if (accessibilityActive) {
    effectivePlan = "PREMIUM";
    status = "active";
  } else if (earlyTesterActive) {
    effectivePlan = "PREMIUM";
    status = "active";
  } else {
    effectivePlan = "FREE";
    if (basePlan !== "FREE" || isEarlyTester && earlyTesterEndDate !== null && earlyTesterEndDate <= nowMs) {
      status = raw.status === "canceled" ? "canceled" : "expired";
    } else {
      status = "active";
    }
  }
  return {
    uid: raw.uid,
    email: raw.email ?? null,
    plan: basePlan,
    effectivePlan,
    status,
    billingCycle: raw.billingCycle || "monthly",
    startDate,
    endDate,
    isLifetime,
    cancelAtPeriodEnd: Boolean(raw.cancelAtPeriodEnd),
    isEarlyTester,
    earlyTesterStartDate,
    earlyTesterEndDate,
    earlyTesterBadge: earlyTesterActive ? "Pioneer \u2014 Premium gratuit 2 ans" : null,
    isAccessibilityLifetime: Boolean(raw.isAccessibilityLifetime),
    activationSource: raw.activationSource ?? (accessibilityActive ? "accessibility" : earlyTesterActive ? "pioneer" : raw.paymentProvider || "free"),
    paymentProvider: raw.paymentProvider ?? (accessibilityActive ? "accessibility" : earlyTesterActive ? "early_tester" : null),
    paymentVerified: Boolean(raw.paymentVerified || earlyTesterActive || accessibilityActive),
    lastPaymentRef: raw.lastPaymentRef ?? null,
    updatedAt: raw.updatedAt || nowMs,
    entitlements: getEntitlementsForPlan(effectivePlan)
  };
}
function hasFeatureAccess(subscription, feature) {
  if (!subscription) return false;
  const e = subscription.entitlements;
  switch (feature) {
    case "sos":
      return e.canUseSos;
    case "emergency_contacts":
      return e.canManageEmergencyContacts;
    case "auto_emergency_alerts":
      return e.canUseAutoAlerts;
    case "realtime_location_sharing":
      return e.canShareLiveLocation;
    case "safety_history":
      return e.canViewSafetyHistory;
    case "smart_localization":
      return e.canUseSmartLocalization;
    case "smart_navigation":
      return e.canUseSmartNavigation;
    case "custom_alerts":
      return e.canUseCustomAlerts;
    case "advanced_stats":
      return e.canUseAdvancedStats;
    case "global_risk_heatmap":
      return e.canViewRiskHeatmap;
    case "family_profiles":
    case "family_management":
    case "family_location_sharing":
    case "family_emergency_contacts":
    case "family_safety_alerts":
    case "family_dashboard":
      return e.canUseFamilyDashboard;
    case "family_member_settings":
      return e.canManageFamilySettings;
    case "business_fleet":
    case "business_api":
      return e.canUseBusinessFeatures;
    default:
      return false;
  }
}
function getRequiredPlanForFeature(feature) {
  switch (feature) {
    case "family_profiles":
    case "family_management":
    case "family_location_sharing":
    case "family_emergency_contacts":
    case "family_safety_alerts":
    case "family_dashboard":
    case "family_member_settings":
      return "FAMILY";
    case "business_fleet":
    case "business_api":
      return "BUSINESS";
    default:
      return "PREMIUM";
  }
}
var DEFAULT_REGIONAL_PLANS = {
  FREE: {
    id: "FREE",
    enabled: true,
    monthlyPriceTnd: 0,
    annualPriceTnd: 0,
    monthlyPriceEur: 0,
    annualPriceEur: 0
  },
  PREMIUM: {
    id: "PREMIUM",
    enabled: true,
    monthlyPriceTnd: 4.9,
    annualPriceTnd: 49,
    monthlyPriceEur: 3.9,
    annualPriceEur: 39
  },
  FAMILY: {
    id: "FAMILY",
    enabled: true,
    monthlyPriceTnd: 9.9,
    annualPriceTnd: 99,
    monthlyPriceEur: 7.9,
    annualPriceEur: 79
  },
  BUSINESS: {
    id: "BUSINESS",
    enabled: true,
    monthlyPriceTnd: null,
    annualPriceTnd: null,
    monthlyPriceEur: null,
    annualPriceEur: null,
    customPricing: true
  }
};
function getCurrencyForCountry(countryCode) {
  if (typeof countryCode === "string" && countryCode.trim().toUpperCase() === "TN") {
    return "TND";
  }
  return "EUR";
}
var PAYMENT_PROVIDER_CURRENCIES = {
  konnect: ["TND"],
  stripe: ["EUR", "TND"]
};
function isProviderCompatibleWithCurrency(provider, currency) {
  return PAYMENT_PROVIDER_CURRENCIES[provider]?.includes(currency) ?? false;
}
function getCompatibleProvidersForCurrency(currency) {
  return currency === "TND" ? ["konnect", "stripe"] : ["stripe"];
}
function toStripeUnitAmount(amount, currency) {
  return currency === "TND" ? Math.round(amount * 1e3) : Math.round(amount * 100);
}

// server/apkValidator.ts
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var import_crypto = __toESM(require("crypto"), 1);
var ALLOWED_APK_MIME_TYPES = /* @__PURE__ */ new Set([
  "application/vnd.android.package-archive",
  "application/octet-stream",
  "application/zip",
  "application/x-zip-compressed",
  "application/java-archive",
  "binary/octet-stream"
]);
var FORBIDDEN_EMBEDDED_EXTENSIONS = [".exe", ".bat", ".cmd", ".msi", ".vbs", ".ps1", ".scr", ".com"];
function sanitizeApkFileName(originalName) {
  const base = import_path.default.basename(originalName || "vruguard.apk").replace(/[^a-zA-Z0-9._-]/g, "_");
  if (!base.toLowerCase().endsWith(".apk")) {
    return `${base}.apk`;
  }
  return base;
}
function computeFileSha256(filePath) {
  return new Promise((resolve, reject) => {
    const hash = import_crypto.default.createHash("sha256");
    const stream = import_fs.default.createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
    stream.on("error", (err) => reject(err));
  });
}
function getAvailableStorageBytes(targetDir) {
  try {
    if (!import_fs.default.existsSync(targetDir)) {
      import_fs.default.mkdirSync(targetDir, { recursive: true });
    }
    const stat = import_fs.default.statfsSync(targetDir);
    return Number(stat.bavail) * Number(stat.bsize);
  } catch {
    return null;
  }
}
function inspectApkZipStructure(filePath, fileSize) {
  const fd = import_fs.default.openSync(filePath, "r");
  try {
    const header = Buffer.alloc(4);
    const bytesRead = import_fs.default.readSync(fd, header, 0, 4, 0);
    if (bytesRead < 4 || header[0] !== 80 || header[1] !== 75 || header[2] !== 3 || header[3] !== 4) {
      return {
        ok: false,
        entriesCount: 0,
        hasAndroidManifest: false,
        hasDexOrResources: false,
        error: "Signature binaire invalide : ce fichier n\u2019est pas une archive APK/ZIP authentique."
      };
    }
    const tailSize = Math.min(fileSize, 65557);
    const tailOffset = fileSize - tailSize;
    const tailBuf = Buffer.alloc(tailSize);
    import_fs.default.readSync(fd, tailBuf, 0, tailSize, tailOffset);
    let eocdPos = -1;
    for (let i = tailSize - 22; i >= 0; i--) {
      if (tailBuf[i] === 80 && tailBuf[i + 1] === 75 && tailBuf[i + 2] === 5 && tailBuf[i + 3] === 6) {
        const commentLen = tailBuf.readUInt16LE(i + 20);
        if (i + 22 + commentLen === tailSize) {
          eocdPos = i;
          break;
        }
      }
    }
    if (eocdPos === -1) {
      return {
        ok: false,
        entriesCount: 0,
        hasAndroidManifest: false,
        hasDexOrResources: false,
        error: "Structure APK corrompue : r\xE9pertoire central ZIP introuvable."
      };
    }
    const totalEntries = tailBuf.readUInt16LE(eocdPos + 10);
    const cdSize = tailBuf.readUInt32LE(eocdPos + 12);
    const cdOffset = tailBuf.readUInt32LE(eocdPos + 16);
    if (cdSize === 0 || cdSize > 32 * 1024 * 1024 || cdOffset + cdSize > fileSize) {
      return {
        ok: false,
        entriesCount: 0,
        hasAndroidManifest: false,
        hasDexOrResources: false,
        error: "Table centrale APK invalide ou hors limites."
      };
    }
    const cdBuf = Buffer.alloc(cdSize);
    import_fs.default.readSync(fd, cdBuf, 0, cdSize, cdOffset);
    let cursor = 0;
    let parsedEntries = 0;
    let hasAndroidManifest = false;
    let hasDexOrResources = false;
    while (cursor + 46 <= cdBuf.length && parsedEntries < totalEntries + 1e3) {
      if (cdBuf[cursor] !== 80 || cdBuf[cursor + 1] !== 75 || cdBuf[cursor + 2] !== 1 || cdBuf[cursor + 3] !== 2) {
        break;
      }
      const fileNameLen = cdBuf.readUInt16LE(cursor + 28);
      const extraFieldLen = cdBuf.readUInt16LE(cursor + 30);
      const commentLen = cdBuf.readUInt16LE(cursor + 32);
      const nextCursor = cursor + 46 + fileNameLen + extraFieldLen + commentLen;
      if (nextCursor > cdBuf.length) break;
      const entryName = cdBuf.toString("utf8", cursor + 46, cursor + 46 + fileNameLen);
      const lowerName = entryName.toLowerCase();
      if (lowerName === "androidmanifest.xml") {
        hasAndroidManifest = true;
      }
      if (lowerName === "classes.dex" || lowerName === "resources.arsc" || lowerName.startsWith("meta-inf/")) {
        hasDexOrResources = true;
      }
      if (FORBIDDEN_EMBEDDED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
        return {
          ok: false,
          entriesCount: parsedEntries,
          hasAndroidManifest,
          hasDexOrResources,
          error: `Contenu suspect d\xE9tect\xE9 dans l\u2019archive (${import_path.default.basename(entryName)}). Upload bloqu\xE9.`
        };
      }
      parsedEntries++;
      cursor = nextCursor;
    }
    if (!hasAndroidManifest) {
      return {
        ok: false,
        entriesCount: parsedEntries,
        hasAndroidManifest: false,
        hasDexOrResources,
        error: "Fichier rejet\xE9 : AndroidManifest.xml absent. Seuls les paquets Android (.apk) authentiques sont accept\xE9s."
      };
    }
    return {
      ok: true,
      entriesCount: parsedEntries,
      hasAndroidManifest,
      hasDexOrResources
    };
  } finally {
    import_fs.default.closeSync(fd);
  }
}
async function validateAndInspectApkFile(params) {
  const cleanName = import_path.default.basename(params.originalName || "");
  if (!cleanName.toLowerCase().endsWith(".apk")) {
    return {
      valid: false,
      fileSize: 0,
      sha256: "",
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: "Extension non autoris\xE9e : le fichier doit obligatoirement porter l\u2019extension .apk."
    };
  }
  const normalizedMime = (params.mimeType || "").toLowerCase().split(";")[0].trim();
  if (normalizedMime && !ALLOWED_APK_MIME_TYPES.has(normalizedMime)) {
    return {
      valid: false,
      fileSize: 0,
      sha256: "",
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: `Type MIME non autoris\xE9 (${normalizedMime}).`
    };
  }
  if (!import_fs.default.existsSync(params.filePath)) {
    return {
      valid: false,
      fileSize: 0,
      sha256: "",
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: "Fichier temporaire introuvable apr\xE8s transfert."
    };
  }
  const stat = import_fs.default.statSync(params.filePath);
  const fileSize = stat.size;
  if (fileSize < 128) {
    return {
      valid: false,
      fileSize,
      sha256: "",
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: "Fichier APK trop petit ou vide."
    };
  }
  if (fileSize > params.maxSizeBytes) {
    const maxMb = Math.round(params.maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      fileSize,
      sha256: "",
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: `Le fichier d\xE9passe la limite maximale autoris\xE9e (${maxMb} Mo).`
    };
  }
  const availBytes = getAvailableStorageBytes(params.storageDir);
  if (availBytes !== null && availBytes < fileSize * 2 + 10 * 1024 * 1024) {
    return {
      valid: false,
      fileSize,
      sha256: "",
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: "Capacit\xE9 de stockage serveur insuffisante pour archiver et sauvegarder cet APK."
    };
  }
  const zipCheck = inspectApkZipStructure(params.filePath, fileSize);
  if (!zipCheck.ok) {
    return {
      valid: false,
      fileSize,
      sha256: "",
      entriesCount: zipCheck.entriesCount,
      hasAndroidManifest: zipCheck.hasAndroidManifest,
      hasDexOrResources: zipCheck.hasDexOrResources,
      error: zipCheck.error
    };
  }
  const sha256 = await computeFileSha256(params.filePath);
  return {
    valid: true,
    fileSize,
    sha256,
    entriesCount: zipCheck.entriesCount,
    hasAndroidManifest: zipCheck.hasAndroidManifest,
    hasDexOrResources: zipCheck.hasDexOrResources
  };
}

// server/subscriptionStore.ts
var CURRENT_CONSENT_VERSION = "2026.1";
var CURRENT_TERMS_VERSION = "2026.1";
var CURRENT_PRIVACY_VERSION = "2026.1";
var DATA_DIR = import_path2.default.join(process.cwd(), ".data");
var STORE_PATH = import_path2.default.join(DATA_DIR, "subscriptions.json");
var ACCESSIBILITY_DOCS_DIR = import_path2.default.join(DATA_DIR, "accessibility_docs");
var APK_RELEASES_DIR = import_path2.default.join(DATA_DIR, "apk_releases");
var APK_BACKUPS_DIR = import_path2.default.join(DATA_DIR, "apk_backups");
var APK_TMP_DIR = import_path2.default.join(DATA_DIR, "apk_tmp");
var DEFAULT_SUPER_ADMIN_EMAILS = ["medbenhasan@gmail.com", "medbenhasa@gmail.com"];
function getSuperAdminEmails() {
  const envRaw = process.env.SUPER_ADMIN_EMAILS;
  if (envRaw && envRaw.trim()) {
    return envRaw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return DEFAULT_SUPER_ADMIN_EMAILS;
}
function getRolloutCutoffMs() {
  const iso = process.env.EARLY_TESTER_ROLLOUT_ISO;
  if (iso) {
    const parsed = Date.parse(iso);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return EARLY_TESTER_ROLLOUT_MS;
}
function createDefaultRegionalPlans() {
  return {
    FREE: { ...DEFAULT_REGIONAL_PLANS.FREE },
    PREMIUM: { ...DEFAULT_REGIONAL_PLANS.PREMIUM },
    FAMILY: { ...DEFAULT_REGIONAL_PLANS.FAMILY },
    BUSINESS: { ...DEFAULT_REGIONAL_PLANS.BUSINESS }
  };
}
function normalizeRegionalPlansFromSettings(planPrices, existingRegional) {
  const defaults = createDefaultRegionalPlans();
  return {
    FREE: {
      ...defaults.FREE,
      ...existingRegional?.FREE || {},
      id: "FREE",
      enabled: existingRegional?.FREE?.enabled ?? true,
      monthlyPriceTnd: 0,
      annualPriceTnd: 0,
      monthlyPriceEur: 0,
      annualPriceEur: 0
    },
    PREMIUM: {
      ...defaults.PREMIUM,
      ...existingRegional?.PREMIUM || {},
      id: "PREMIUM",
      enabled: existingRegional?.PREMIUM?.enabled ?? true,
      monthlyPriceTnd: planPrices.premiumMonthlyTnd,
      annualPriceTnd: planPrices.premiumAnnualTnd,
      monthlyPriceEur: planPrices.premiumMonthlyEur,
      annualPriceEur: planPrices.premiumAnnualEur
    },
    FAMILY: {
      ...defaults.FAMILY,
      ...existingRegional?.FAMILY || {},
      id: "FAMILY",
      enabled: existingRegional?.FAMILY?.enabled ?? true,
      monthlyPriceTnd: planPrices.familyMonthlyTnd,
      annualPriceTnd: planPrices.familyAnnualTnd,
      monthlyPriceEur: planPrices.familyMonthlyEur,
      annualPriceEur: planPrices.familyAnnualEur
    },
    BUSINESS: {
      ...defaults.BUSINESS,
      ...existingRegional?.BUSINESS || {},
      id: "BUSINESS",
      enabled: existingRegional?.BUSINESS?.enabled ?? true,
      customPricing: true
    }
  };
}
function createDefaultPlatformSettings() {
  const planPrices = {
    premiumMonthlyTnd: 4.9,
    premiumAnnualTnd: 49,
    premiumMonthlyEur: 3.9,
    premiumAnnualEur: 39,
    familyMonthlyTnd: 9.9,
    familyAnnualTnd: 99,
    familyMonthlyEur: 7.9,
    familyAnnualEur: 79
  };
  return {
    platformName: "VruGuard",
    logoUrl: "",
    contactEmail: "contact@vruguard.me",
    supportEmail: "support@vruguard.me",
    planPrices,
    regionalPlans: normalizeRegionalPlansFromSettings(planPrices),
    pioneerProgramEnabled: true,
    pioneerDurationDays: 730,
    accessibilityProgramEnabled: true,
    notificationsEnabled: true,
    maintenanceMode: false,
    maintenanceMessage: "Une op\xE9ration de maintenance planifi\xE9e est en cours. L\u2019acc\xE8s complet sera r\xE9tabli tr\xE8s prochainement.",
    announcementEnabled: false,
    announcementText: "",
    announcementType: "info",
    securitySettings: {
      requireReauthForCriticalActions: true,
      adminRateLimitPerMin: 120,
      delegatedAdminEmails: [],
      permissionMatrix: {
        SUPER_ADMIN: [
          "users:read",
          "users:suspend",
          "users:ban",
          "users:delete",
          "subscriptions:write",
          "redeem:write",
          "accessibility:review",
          "pioneer:write",
          "notifications:send",
          "support:write",
          "settings:write",
          "security:write",
          "audit:read",
          "android:read",
          "android:write",
          "consent:read"
        ],
        ADMIN: [
          "users:read",
          "users:suspend",
          "subscriptions:write",
          "redeem:write",
          "accessibility:review",
          "support:write",
          "audit:read",
          "android:read",
          "android:write",
          "consent:read"
        ]
      }
    },
    updatedAt: Date.now(),
    updatedBy: "system"
  };
}
function createDefaultAndroidAppSettings() {
  return {
    downloadsEnabled: true,
    appName: "VruGuard",
    packageName: "com.vruguard.sentinel",
    description: "Application Android VruGuard pour la localisation intelligente, les alertes de proximit\xE9 VRU, la navigation adapt\xE9e et l\u2019assistance SOS.",
    minSupportedVersionCode: 1,
    retentionKeepCount: 3,
    maxApkSizeBytes: 200 * 1024 * 1024,
    // 200 MB
    updatedAt: Date.now(),
    updatedBy: "system"
  };
}
function createEmptyStore() {
  return {
    schemaVersion: 3,
    subscriptions: {},
    subscriptionHistory: {},
    transactions: {},
    familyProfiles: {},
    businessQuotes: [],
    earlyTesterEmails: {},
    redeemCodes: {},
    activations: [],
    userDirectory: {},
    presence: {},
    accessibilityRequests: [],
    platformSettings: createDefaultPlatformSettings(),
    priceChangeHistory: [],
    adminNotifications: [],
    supportTickets: [],
    auditLogs: [],
    androidAppSettings: createDefaultAndroidAppSettings(),
    androidReleases: [],
    androidDownloadEvents: [],
    userConsents: {}
  };
}
function hashRedeemCode(normalizedCode) {
  return import_crypto2.default.createHash("sha256").update(normalizedCode).digest("hex");
}
function maskRedeemCode(normalizedCode) {
  const parts = normalizedCode.split("-");
  if (parts.length >= 4) {
    return `${parts[0]}-${parts[1]}-\u2022\u2022\u2022\u2022-${parts[parts.length - 1]}`;
  }
  if (normalizedCode.length > 8) {
    return `${normalizedCode.slice(0, 6)}\u2022\u2022\u2022\u2022${normalizedCode.slice(-4)}`;
  }
  return "VRU-\u2022\u2022\u2022\u2022";
}
var SubscriptionStore = class {
  constructor() {
    this.redeemLocks = /* @__PURE__ */ new Set();
    this.consentLocks = /* @__PURE__ */ new Set();
    this.data = this.loadFromDisk();
  }
  ensureDirectories() {
    for (const dir of [
      DATA_DIR,
      ACCESSIBILITY_DOCS_DIR,
      APK_RELEASES_DIR,
      APK_BACKUPS_DIR,
      APK_TMP_DIR
    ]) {
      if (!import_fs2.default.existsSync(dir)) {
        import_fs2.default.mkdirSync(dir, { recursive: true });
      }
    }
  }
  loadFromDisk() {
    try {
      this.ensureDirectories();
      if (!import_fs2.default.existsSync(STORE_PATH)) {
        const initial = createEmptyStore();
        import_fs2.default.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf8");
        return initial;
      }
      const raw = import_fs2.default.readFileSync(STORE_PATH, "utf8");
      const parsed = JSON.parse(raw);
      const defaults = createDefaultPlatformSettings();
      const mergedPlanPrices = {
        ...defaults.planPrices,
        ...parsed.platformSettings?.planPrices || {}
      };
      const existingMatrix = parsed.platformSettings?.securitySettings?.permissionMatrix || {};
      const migratedMatrix = {
        ...defaults.securitySettings.permissionMatrix,
        ...existingMatrix
      };
      for (const roleKey of ["SUPER_ADMIN", "ADMIN"]) {
        const currentPerms = new Set(migratedMatrix[roleKey] || []);
        currentPerms.add("android:read");
        currentPerms.add("android:write");
        currentPerms.add("consent:read");
        migratedMatrix[roleKey] = Array.from(currentPerms);
      }
      const loadedSettings = parsed.platformSettings ? {
        ...defaults,
        ...parsed.platformSettings,
        planPrices: mergedPlanPrices,
        regionalPlans: normalizeRegionalPlansFromSettings(
          mergedPlanPrices,
          parsed.platformSettings.regionalPlans
        ),
        securitySettings: {
          ...defaults.securitySettings,
          ...parsed.platformSettings.securitySettings || {},
          permissionMatrix: migratedMatrix
        }
      } : defaults;
      const normalizedTransactions = {};
      Object.entries(parsed.transactions || {}).forEach(([id, tx]) => {
        const legacyAmount = tx.amountTnd ?? 0;
        normalizedTransactions[id] = {
          ...tx,
          amount: typeof tx.amount === "number" ? tx.amount : legacyAmount,
          currency: tx.currency === "EUR" ? "EUR" : "TND"
        };
      });
      const normalizedAudit = (parsed.auditLogs || []).map((entry) => ({
        id: entry.id || `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: entry.timestamp || Date.now(),
        adminUid: entry.adminUid || entry.uid || "system",
        adminEmail: entry.adminEmail || entry.uid || "system",
        adminRole: entry.adminRole || "OPERATOR",
        action: entry.action || "EVENT",
        category: entry.category || "subscription",
        targetUid: entry.targetUid || entry.uid || null,
        targetEmail: entry.targetEmail || null,
        targetId: entry.targetId || null,
        oldValue: entry.oldValue,
        newValue: entry.newValue,
        outcome: entry.outcome || "success",
        ip: entry.ip || null,
        detail: entry.detail || ""
      }));
      const defaultAndroidSettings = createDefaultAndroidAppSettings();
      const loadedAndroidSettings = {
        ...defaultAndroidSettings,
        ...parsed.androidAppSettings || {}
      };
      const needsSchemaMigration = !parsed.schemaVersion || parsed.schemaVersion < 3 || !parsed.androidAppSettings || !Array.isArray(parsed.androidReleases) || !Array.isArray(parsed.androidDownloadEvents) || !parsed.userConsents || typeof parsed.userConsents !== "object";
      const migrated = {
        schemaVersion: 3,
        subscriptions: parsed.subscriptions || {},
        subscriptionHistory: parsed.subscriptionHistory || {},
        transactions: normalizedTransactions,
        familyProfiles: parsed.familyProfiles || {},
        businessQuotes: parsed.businessQuotes || [],
        earlyTesterEmails: parsed.earlyTesterEmails || {},
        redeemCodes: parsed.redeemCodes || {},
        activations: parsed.activations || [],
        userDirectory: parsed.userDirectory || {},
        presence: parsed.presence || {},
        accessibilityRequests: parsed.accessibilityRequests || [],
        platformSettings: loadedSettings,
        priceChangeHistory: parsed.priceChangeHistory || [],
        adminNotifications: parsed.adminNotifications || [],
        supportTickets: parsed.supportTickets || [],
        auditLogs: normalizedAudit,
        androidAppSettings: loadedAndroidSettings,
        androidReleases: Array.isArray(parsed.androidReleases) ? parsed.androidReleases : [],
        androidDownloadEvents: Array.isArray(parsed.androidDownloadEvents) ? parsed.androidDownloadEvents : [],
        // Existing users created prior to First Login Consent are NEVER auto-accepted:
        userConsents: parsed.userConsents && typeof parsed.userConsents === "object" ? parsed.userConsents : {}
      };
      if (needsSchemaMigration) {
        const tmpPath = `${STORE_PATH}.tmp`;
        import_fs2.default.writeFileSync(tmpPath, JSON.stringify(migrated, null, 2), "utf8");
        import_fs2.default.renameSync(tmpPath, STORE_PATH);
      }
      return migrated;
    } catch (err) {
      console.error("Failed to load subscription store, initializing fresh store:", err);
      return createEmptyStore();
    }
  }
  persist() {
    try {
      if (!import_fs2.default.existsSync(DATA_DIR)) {
        import_fs2.default.mkdirSync(DATA_DIR, { recursive: true });
      }
      const tmpPath = `${STORE_PATH}.tmp`;
      import_fs2.default.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), "utf8");
      import_fs2.default.renameSync(tmpPath, STORE_PATH);
    } catch (err) {
      console.error("Failed to persist subscription store:", err);
    }
  }
  // --- Immutable Audit Logs ---
  recordAuditLog(params) {
    const entry = {
      id: `aud_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`,
      timestamp: Date.now(),
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: params.adminRole || "OPERATOR",
      action: params.action,
      category: params.category,
      targetUid: params.targetUid ?? null,
      targetEmail: params.targetEmail ?? null,
      targetId: params.targetId ?? null,
      oldValue: params.oldValue,
      newValue: params.newValue,
      outcome: params.outcome || "success",
      ip: params.ip ?? null,
      detail: params.detail
    };
    this.data.auditLogs.unshift(entry);
    if (this.data.auditLogs.length > 5e3) {
      this.data.auditLogs.length = 5e3;
    }
    this.persist();
    return entry;
  }
  addAudit(uid, action, detail, category = "subscription") {
    this.data.auditLogs.unshift({
      id: `aud_${Date.now()}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      timestamp: Date.now(),
      adminUid: uid,
      adminEmail: uid,
      action,
      category,
      targetUid: uid,
      outcome: "success",
      detail
    });
    if (this.data.auditLogs.length > 5e3) {
      this.data.auditLogs.length = 5e3;
    }
  }
  listAuditLogs(options) {
    const q = (options?.search || "").trim().toLowerCase();
    const limit = Math.min(500, Math.max(1, options?.limit || 200));
    return this.data.auditLogs.filter((log) => {
      if (options?.category && options.category !== "ALL" && log.category !== options.category) {
        return false;
      }
      if (options?.outcome && options.outcome !== "ALL" && log.outcome !== options.outcome) {
        return false;
      }
      if (!q) return true;
      return log.action.toLowerCase().includes(q) || log.detail.toLowerCase().includes(q) || log.adminEmail.toLowerCase().includes(q) || (log.targetEmail || "").toLowerCase().includes(q) || (log.targetUid || "").toLowerCase().includes(q);
    }).slice(0, limit);
  }
  // --- Role & Security Resolution ---
  resolveUserRole(email, emailVerified) {
    if (!email || !emailVerified) return "OPERATOR";
    const clean = email.toLowerCase().trim();
    if (getSuperAdminEmails().includes(clean)) return "SUPER_ADMIN";
    const delegated = (this.data.platformSettings.securitySettings.delegatedAdminEmails || []).map(
      (e) => e.toLowerCase().trim()
    );
    if (delegated.includes(clean)) return "ADMIN";
    return "OPERATOR";
  }
  isAuthorizedAdminEmail(email, emailVerified) {
    const role = this.resolveUserRole(email, emailVerified);
    return role === "SUPER_ADMIN" || role === "ADMIN";
  }
  hasPermission(role, permission) {
    if (role === "SUPER_ADMIN") return true;
    const perms = this.data.platformSettings.securitySettings.permissionMatrix?.[role] || [];
    return perms.includes(permission);
  }
  // --- User Directory & Governance ---
  upsertDirectoryUser(input) {
    const now = Date.now();
    const existing = this.data.userDirectory[input.uid];
    const resolvedEmail = input.email !== void 0 ? input.email : existing?.email ?? null;
    const resolvedVerified = input.emailVerified !== void 0 ? input.emailVerified : existing?.emailVerified ?? false;
    const computedRole = this.resolveUserRole(resolvedEmail, resolvedVerified);
    if (!existing) {
      const created = {
        uid: input.uid,
        email: resolvedEmail,
        displayName: input.displayName ?? null,
        photoURL: input.photoURL ?? null,
        emailVerified: resolvedVerified,
        role: computedRole,
        createdAt: input.createdAt ?? now,
        lastLoginAt: input.lastLoginAt ?? now,
        accountStatus: "active",
        sanctionHistory: []
      };
      this.data.userDirectory[input.uid] = created;
      this.persist();
      return created;
    }
    let changed = false;
    if (resolvedEmail && existing.email !== resolvedEmail) {
      existing.email = resolvedEmail;
      changed = true;
    }
    if (input.displayName && existing.displayName !== input.displayName) {
      existing.displayName = input.displayName;
      changed = true;
    }
    if (input.photoURL !== void 0 && existing.photoURL !== input.photoURL) {
      existing.photoURL = input.photoURL;
      changed = true;
    }
    if (input.emailVerified !== void 0 && existing.emailVerified !== input.emailVerified) {
      existing.emailVerified = input.emailVerified;
      changed = true;
    }
    if (input.createdAt && (!existing.createdAt || input.createdAt < existing.createdAt)) {
      existing.createdAt = input.createdAt;
      changed = true;
    }
    if (input.lastLoginAt && (!existing.lastLoginAt || input.lastLoginAt > existing.lastLoginAt)) {
      existing.lastLoginAt = input.lastLoginAt;
      changed = true;
    }
    if (existing.role !== computedRole) {
      existing.role = computedRole;
      changed = true;
    }
    if (existing.accountStatus === "suspended" && existing.suspensionExpiresAt && existing.suspensionExpiresAt <= now) {
      existing.accountStatus = "active";
      existing.suspensionReason = null;
      existing.suspensionExpiresAt = null;
      changed = true;
    }
    if (changed) {
      this.persist();
    }
    return existing;
  }
  getUserGovernance(uid) {
    const rec = this.data.userDirectory[uid];
    if (!rec) return null;
    const now = Date.now();
    if (rec.accountStatus === "suspended" && rec.suspensionExpiresAt && rec.suspensionExpiresAt <= now) {
      rec.accountStatus = "active";
      rec.suspensionReason = null;
      rec.suspensionExpiresAt = null;
      this.persist();
    }
    return rec;
  }
  suspendUser(params) {
    const now = Date.now();
    const user = this.data.userDirectory[params.targetUid] || this.upsertDirectoryUser({ uid: params.targetUid });
    const safeHours = Math.max(1, Math.min(24 * 365, Math.floor(params.durationHours || 24)));
    const expiresAt = now + safeHours * 60 * 60 * 1e3;
    const oldStatus = user.accountStatus;
    user.accountStatus = "suspended";
    user.suspensionReason = params.reason.trim();
    user.suspendedAt = now;
    user.suspensionExpiresAt = expiresAt;
    user.revokedAfter = now;
    user.sanctionHistory.unshift({
      id: `sanc_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      action: "suspend",
      reason: user.suspensionReason,
      durationHours: safeHours,
      expiresAt,
      adminEmail: params.adminEmail,
      createdAt: now
    });
    if (this.data.presence[params.targetUid]) {
      this.data.presence[params.targetUid].rawState = "offline";
    }
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "USER_SUSPENDED",
      category: "user",
      targetUid: params.targetUid,
      targetEmail: user.email,
      oldValue: { accountStatus: oldStatus },
      newValue: { accountStatus: "suspended", expiresAt, reason: user.suspensionReason },
      ip: params.ip,
      detail: `Compte suspendu pour ${safeHours}h : ${user.suspensionReason}`
    });
    this.persist();
    return user;
  }
  banUser(params) {
    const now = Date.now();
    const user = this.data.userDirectory[params.targetUid] || this.upsertDirectoryUser({ uid: params.targetUid });
    const oldStatus = user.accountStatus;
    user.accountStatus = "banned";
    user.banReason = params.reason.trim();
    user.bannedAt = now;
    user.suspensionReason = null;
    user.suspensionExpiresAt = null;
    user.revokedAfter = now;
    user.sanctionHistory.unshift({
      id: `sanc_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      action: "ban",
      reason: user.banReason,
      adminEmail: params.adminEmail,
      createdAt: now
    });
    if (this.data.presence[params.targetUid]) {
      this.data.presence[params.targetUid].rawState = "offline";
    }
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "USER_BANNED",
      category: "user",
      targetUid: params.targetUid,
      targetEmail: user.email,
      oldValue: { accountStatus: oldStatus },
      newValue: { accountStatus: "banned", reason: user.banReason },
      ip: params.ip,
      detail: `Compte banni d\xE9finitivement : ${user.banReason}`
    });
    this.persist();
    return user;
  }
  unbanOrReactivateUser(params) {
    const now = Date.now();
    const user = this.data.userDirectory[params.targetUid] || this.upsertDirectoryUser({ uid: params.targetUid });
    const oldStatus = user.accountStatus;
    user.accountStatus = "active";
    user.banReason = null;
    user.suspensionReason = null;
    user.suspensionExpiresAt = null;
    user.softDeletedAt = null;
    user.deletionReason = null;
    user.sanctionHistory.unshift({
      id: `sanc_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      action: "unban",
      reason: params.reason?.trim() || "R\xE9activation manuelle par Super Admin",
      adminEmail: params.adminEmail,
      createdAt: now
    });
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "USER_REACTIVATED",
      category: "user",
      targetUid: params.targetUid,
      targetEmail: user.email,
      oldValue: { accountStatus: oldStatus },
      newValue: { accountStatus: "active" },
      ip: params.ip,
      detail: `Compte r\xE9activ\xE9 (${oldStatus} -> active). Motif : ${params.reason || "R\xE9activation admin"}`
    });
    this.persist();
    return user;
  }
  revokeUserSessions(params) {
    const now = Date.now();
    const user = this.data.userDirectory[params.targetUid] || this.upsertDirectoryUser({ uid: params.targetUid });
    user.revokedAfter = now;
    user.sanctionHistory.unshift({
      id: `sanc_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      action: "revoke_sessions",
      reason: params.reason?.trim() || "R\xE9vocation forc\xE9e des sessions actives",
      adminEmail: params.adminEmail,
      createdAt: now
    });
    if (this.data.presence[params.targetUid]) {
      this.data.presence[params.targetUid].rawState = "offline";
    }
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "USER_SESSIONS_REVOKED",
      category: "security",
      targetUid: params.targetUid,
      targetEmail: user.email,
      ip: params.ip,
      detail: `Sessions utilisateur r\xE9voqu\xE9es (${user.email || params.targetUid})`
    });
    this.persist();
    return user;
  }
  softDeleteUser(params) {
    const now = Date.now();
    const user = this.data.userDirectory[params.targetUid] || this.upsertDirectoryUser({ uid: params.targetUid });
    const oldStatus = user.accountStatus;
    user.accountStatus = "soft_deleted";
    user.softDeletedAt = now;
    user.deletionReason = params.reason.trim();
    user.revokedAfter = now;
    user.sanctionHistory.unshift({
      id: `sanc_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      action: "soft_delete",
      reason: user.deletionReason,
      adminEmail: params.adminEmail,
      createdAt: now
    });
    if (this.data.presence[params.targetUid]) {
      this.data.presence[params.targetUid].rawState = "offline";
    }
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "USER_SOFT_DELETED",
      category: "user",
      targetUid: params.targetUid,
      targetEmail: user.email,
      oldValue: { accountStatus: oldStatus },
      newValue: { accountStatus: "soft_deleted", reason: user.deletionReason },
      ip: params.ip,
      detail: `Suppression logique (soft delete) du compte : ${user.deletionReason}`
    });
    this.persist();
    return user;
  }
  hardDeleteUser(params) {
    const user = this.data.userDirectory[params.targetUid];
    const targetEmail = user?.email || this.data.subscriptions[params.targetUid]?.email || null;
    delete this.data.userDirectory[params.targetUid];
    delete this.data.subscriptions[params.targetUid];
    delete this.data.subscriptionHistory[params.targetUid];
    delete this.data.familyProfiles[params.targetUid];
    delete this.data.presence[params.targetUid];
    delete this.data.userConsents[params.targetUid];
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "USER_HARD_DELETED",
      category: "user",
      targetUid: params.targetUid,
      targetEmail,
      oldValue: { uid: params.targetUid, email: targetEmail },
      newValue: { deleted: true },
      ip: params.ip,
      detail: `Suppression d\xE9finitive du compte (${targetEmail || params.targetUid}). Motif : ${params.reason}`
    });
    this.persist();
    return { deletedUid: params.targetUid, targetEmail };
  }
  // --- Live Presence Tracking ---
  updatePresenceHeartbeat(params) {
    const now = Date.now();
    const record = {
      uid: params.uid,
      rawState: params.state === "idle" ? "idle" : "online",
      lastHeartbeatAt: now,
      lastInteractionAt: params.lastInteractionAt || now,
      sessionId: params.sessionId,
      currentPage: params.currentPage
    };
    this.data.presence[params.uid] = record;
    this.persist();
    return this.computePresenceState(params.uid, now);
  }
  markPresenceOffline(uid) {
    const existing = this.data.presence[uid];
    if (existing) {
      existing.rawState = "offline";
      existing.lastHeartbeatAt = Date.now();
      this.persist();
    }
  }
  computePresenceState(uid, nowMs = Date.now()) {
    const raw = this.data.presence[uid];
    if (!raw || raw.rawState === "offline") {
      return {
        uid,
        state: "offline",
        lastHeartbeatAt: raw?.lastHeartbeatAt || 0,
        lastInteractionAt: raw?.lastInteractionAt || 0,
        sessionId: raw?.sessionId,
        currentPage: raw?.currentPage
      };
    }
    const sinceHeartbeat = nowMs - raw.lastHeartbeatAt;
    const sinceInteraction = nowMs - (raw.lastInteractionAt || raw.lastHeartbeatAt);
    let state = "offline";
    if (sinceHeartbeat <= 5e4 && raw.rawState === "online" && sinceInteraction <= 95e3) {
      state = "online";
    } else if (sinceHeartbeat <= 13e4) {
      state = "idle";
    } else {
      state = "offline";
    }
    return {
      uid,
      state,
      lastHeartbeatAt: raw.lastHeartbeatAt,
      lastInteractionAt: raw.lastInteractionAt,
      sessionId: raw.sessionId,
      currentPage: raw.currentPage
    };
  }
  listPresenceSummary() {
    const now = Date.now();
    const uids = /* @__PURE__ */ new Set([
      ...Object.keys(this.data.userDirectory),
      ...Object.keys(this.data.subscriptions),
      ...Object.keys(this.data.presence)
    ]);
    let onlineCount = 0;
    let idleCount = 0;
    let offlineCount = 0;
    const records = [];
    uids.forEach((uid) => {
      const p = this.computePresenceState(uid, now);
      records.push(p);
      if (p.state === "online") onlineCount += 1;
      else if (p.state === "idle") idleCount += 1;
      else offlineCount += 1;
    });
    return { onlineCount, idleCount, offlineCount, records };
  }
  // --- Subscriptions & History ---
  appendSubscriptionHistory(uid, entry) {
    const list = this.data.subscriptionHistory[uid] || [];
    list.unshift({
      id: `subh_${entry.timestamp}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      ...entry
    });
    if (list.length > 100) list.length = 100;
    this.data.subscriptionHistory[uid] = list;
  }
  getUserSubscription(uid, options) {
    const now = Date.now();
    let record = this.data.subscriptions[uid];
    if (!record) {
      record = {
        uid,
        email: options?.email || null,
        plan: "FREE",
        status: "active",
        billingCycle: "monthly",
        startDate: now,
        endDate: null,
        isLifetime: false,
        cancelAtPeriodEnd: false,
        isEarlyTester: false,
        earlyTesterStartDate: null,
        earlyTesterEndDate: null,
        isAccessibilityLifetime: false,
        activationSource: "free",
        paymentProvider: null,
        paymentVerified: false,
        lastPaymentRef: null,
        updatedAt: now
      };
      this.data.subscriptions[uid] = record;
    } else if (options?.email && !record.email) {
      record.email = options.email;
    }
    const cutoffMs = getRolloutCutoffMs();
    const createdMs = options?.userCreatedAtMs ?? null;
    const normalizedEmail = (options?.email || record.email || "").toLowerCase().trim();
    const whitelistedEmail = normalizedEmail ? this.data.earlyTesterEmails[normalizedEmail] : void 0;
    if (!record.isEarlyTester && this.data.platformSettings.pioneerProgramEnabled) {
      const pioneerDurationMs = (this.data.platformSettings.pioneerDurationDays || 730) * 24 * 60 * 60 * 1e3;
      if (createdMs !== null && createdMs > 0 && createdMs < cutoffMs) {
        record.isEarlyTester = true;
        record.earlyTesterStartDate = createdMs;
        record.earlyTesterEndDate = createdMs + Math.max(pioneerDurationMs, EARLY_TESTER_DURATION_MS);
        record.paymentProvider = record.paymentProvider || "early_tester";
        record.activationSource = record.activationSource === "free" ? "pioneer" : record.activationSource;
        record.updatedAt = now;
        this.recordActivation({
          uid,
          email: record.email,
          plan: "PREMIUM",
          billingCycle: "annual",
          source: "early_tester",
          code: null,
          startDate: createdMs,
          endDate: record.earlyTesterEndDate,
          activatedAt: now
        });
        this.addAudit(
          uid,
          "EARLY_TESTER_AUTO_PRESERVED",
          `Pre-rollout account (${new Date(createdMs).toISOString()}) granted 2-year Pioneer Premium`,
          "pioneer"
        );
      } else if (whitelistedEmail) {
        record.isEarlyTester = true;
        record.earlyTesterStartDate = whitelistedEmail.startDate;
        record.earlyTesterEndDate = whitelistedEmail.endDate;
        record.paymentProvider = record.paymentProvider || "early_tester";
        record.activationSource = record.activationSource === "free" ? "pioneer" : record.activationSource;
        record.updatedAt = now;
        this.recordActivation({
          uid,
          email: record.email,
          plan: "PREMIUM",
          billingCycle: "annual",
          source: "pioneer",
          code: null,
          startDate: whitelistedEmail.startDate,
          endDate: whitelistedEmail.endDate,
          activatedAt: now
        });
        this.addAudit(
          uid,
          "EARLY_TESTER_WHITELIST_APPLIED",
          `Pioneer email whitelist applied for ${normalizedEmail}`,
          "pioneer"
        );
      }
    }
    const resolved = resolveEffectiveSubscription(record, now);
    if (record.plan !== "FREE" && resolved.effectivePlan === "FREE" && record.status === "active") {
      record.status = record.cancelAtPeriodEnd ? "canceled" : "expired";
      record.updatedAt = now;
      this.addAudit(uid, "SUBSCRIPTION_EXPIRED", `Plan ${record.plan} expired and reverted to FREE`);
    }
    this.persist();
    const transactions = Object.values(this.data.transactions).filter((t) => t.uid === uid).sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
    const activations = this.data.activations.filter((a) => a.uid === uid).sort((a, b) => b.activatedAt - a.activatedAt).slice(0, 30);
    const history = (this.data.subscriptionHistory[uid] || []).slice(0, 50);
    return {
      ...resolved,
      transactions,
      activations,
      history
    };
  }
  adminUpdateUserSubscription(params) {
    const now = Date.now();
    const before = this.getUserSubscription(params.targetUid, { email: params.targetEmail });
    const record = this.data.subscriptions[params.targetUid];
    const oldPlan = before.effectivePlan;
    const oldStatus = before.status;
    if (params.action === "suspend") {
      record.status = "suspended";
      record.updatedAt = now;
    } else if (params.action === "reactivate") {
      record.status = "active";
      record.updatedAt = now;
    } else if (params.action === "downgrade_free") {
      record.plan = "FREE";
      record.status = "active";
      record.endDate = null;
      record.isLifetime = false;
      record.isAccessibilityLifetime = false;
      record.activationSource = "admin";
      record.paymentProvider = "admin";
      record.paymentVerified = false;
      record.updatedAt = now;
    } else if (params.action === "extend") {
      const addDays = Math.max(1, Math.floor(params.durationDays || 30));
      const baseEnd = record.endDate && record.endDate > now ? record.endDate : now;
      record.endDate = baseEnd + addDays * 24 * 60 * 60 * 1e3;
      if (record.plan === "FREE") {
        record.plan = params.plan && params.plan !== "FREE" ? params.plan : "PREMIUM";
      }
      record.status = "active";
      record.paymentVerified = true;
      record.paymentProvider = "admin";
      record.activationSource = params.activationType || "admin";
      record.updatedAt = now;
    } else if (params.action === "grant_lifetime") {
      const targetPlan = params.plan && params.plan !== "FREE" ? params.plan : "PREMIUM";
      record.plan = targetPlan;
      record.status = "active";
      record.billingCycle = "custom";
      record.startDate = params.startDate || now;
      record.endDate = null;
      record.isLifetime = true;
      record.isAccessibilityLifetime = params.activationType === "accessibility";
      record.activationSource = params.activationType || "admin";
      record.paymentProvider = params.activationType === "accessibility" ? "accessibility" : "admin";
      record.paymentVerified = true;
      record.cancelAtPeriodEnd = false;
      record.updatedAt = now;
    } else {
      const nextPlan = params.plan || "PREMIUM";
      if (nextPlan === "FREE") {
        record.plan = "FREE";
        record.status = "active";
        record.endDate = null;
        record.isLifetime = false;
        record.isAccessibilityLifetime = false;
        record.paymentVerified = false;
        record.paymentProvider = "admin";
        record.activationSource = "admin";
      } else {
        const isLifetime = Boolean(params.isLifetime);
        const start = params.startDate || now;
        let end = null;
        if (!isLifetime) {
          if (params.endDate !== void 0) {
            end = params.endDate;
          } else if (params.durationDays && params.durationDays > 0) {
            end = start + params.durationDays * 24 * 60 * 60 * 1e3;
          } else {
            end = start + (params.billingCycle === "annual" ? YEAR_DURATION_MS : MONTH_DURATION_MS);
          }
        }
        record.plan = nextPlan;
        record.status = "active";
        record.billingCycle = isLifetime ? "custom" : params.billingCycle || "custom";
        record.startDate = start;
        record.endDate = end;
        record.isLifetime = isLifetime;
        record.isAccessibilityLifetime = params.activationType === "accessibility" && isLifetime;
        record.activationSource = params.activationType || "admin";
        record.paymentProvider = params.activationType === "accessibility" ? "accessibility" : "admin";
        record.paymentVerified = true;
        record.cancelAtPeriodEnd = false;
      }
      record.updatedAt = now;
    }
    const after = resolveEffectiveSubscription(record, now);
    this.appendSubscriptionHistory(params.targetUid, {
      action: params.action,
      oldPlan,
      newPlan: after.effectivePlan,
      oldStatus,
      newStatus: after.status,
      startDate: after.startDate,
      endDate: after.endDate,
      isLifetime: after.isLifetime,
      source: params.activationType || "admin",
      reason: params.reason,
      adminEmail: params.adminEmail,
      timestamp: now
    });
    if (params.action === "assign" || params.action === "extend" || params.action === "grant_lifetime") {
      this.recordActivation({
        uid: params.targetUid,
        email: record.email || params.targetEmail || null,
        plan: after.effectivePlan,
        billingCycle: after.billingCycle,
        source: params.activationType || "admin",
        code: null,
        startDate: after.startDate,
        endDate: after.endDate,
        isLifetime: after.isLifetime,
        reason: params.reason,
        adminEmail: params.adminEmail,
        activatedAt: now
      });
    }
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: `SUBSCRIPTION_${params.action.toUpperCase()}`,
      category: "subscription",
      targetUid: params.targetUid,
      targetEmail: record.email || params.targetEmail || null,
      oldValue: { plan: oldPlan, status: oldStatus, endDate: before.endDate },
      newValue: {
        plan: after.effectivePlan,
        status: after.status,
        endDate: after.endDate,
        isLifetime: after.isLifetime
      },
      ip: params.ip,
      detail: `Abonnement modifi\xE9 (${oldPlan}/${oldStatus} -> ${after.effectivePlan}/${after.status}). Motif : ${params.reason}`
    });
    this.persist();
    return this.getUserSubscription(params.targetUid);
  }
  recordActivation(entry) {
    const record = {
      id: `act_${entry.activatedAt}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      ...entry
    };
    this.data.activations.unshift(record);
    if (this.data.activations.length > 3e3) {
      this.data.activations.length = 3e3;
    }
    return record;
  }
  createPendingTransaction(params) {
    const now = Date.now();
    const currency = params.currency || "TND";
    const amount = params.amount ?? params.amountTnd ?? 0;
    const tx = {
      id: `tx_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      uid: params.uid,
      plan: params.plan,
      billingCycle: params.billingCycle,
      amount,
      amountTnd: currency === "TND" ? amount : void 0,
      currency,
      country: params.country ?? null,
      provider: params.provider,
      providerSessionId: params.providerSessionId,
      status: "pending",
      createdAt: now
    };
    this.data.transactions[tx.id] = tx;
    this.persist();
    return tx;
  }
  findTransactionByProviderSession(providerSessionId) {
    return Object.values(this.data.transactions).find(
      (tx) => tx.providerSessionId === providerSessionId
    );
  }
  activateVerifiedSubscription(params) {
    const now = Date.now();
    const existing = this.data.subscriptions[params.uid] || {
      uid: params.uid,
      email: params.email || null,
      isEarlyTester: false,
      earlyTesterStartDate: null,
      earlyTesterEndDate: null
    };
    const existingTx = this.findTransactionByProviderSession(params.paymentRef);
    const currency = params.currency || existingTx?.currency || "TND";
    const amount = params.amount ?? params.amountTnd ?? existingTx?.amount ?? 0;
    if (existingTx) {
      existingTx.status = "verified";
      existingTx.verifiedAt = now;
      existingTx.amount = amount;
      existingTx.currency = currency;
      if (params.country !== void 0) {
        existingTx.country = params.country;
      }
      if (currency === "TND") {
        existingTx.amountTnd = amount;
      }
    } else {
      const txId = `tx_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`;
      this.data.transactions[txId] = {
        id: txId,
        uid: params.uid,
        plan: params.plan,
        billingCycle: params.billingCycle,
        amount,
        amountTnd: currency === "TND" ? amount : void 0,
        currency,
        country: params.country ?? null,
        provider: params.provider,
        providerSessionId: params.paymentRef,
        status: "verified",
        createdAt: now,
        verifiedAt: now
      };
    }
    const durationMs = params.durationDays && params.durationDays > 0 ? params.durationDays * 24 * 60 * 60 * 1e3 : params.billingCycle === "annual" ? YEAR_DURATION_MS : MONTH_DURATION_MS;
    const baseStart = !params.isLifetime && existing.plan === params.plan && existing.status === "active" && existing.endDate && existing.endDate > now ? existing.endDate : now;
    const computedEndDate = params.isLifetime || params.plan === "BUSINESS" ? null : baseStart + durationMs;
    this.data.subscriptions[params.uid] = {
      ...existing,
      uid: params.uid,
      email: params.email || existing.email || null,
      plan: params.plan,
      status: "active",
      billingCycle: params.billingCycle,
      startDate: existing.startDate || now,
      endDate: computedEndDate,
      isLifetime: Boolean(params.isLifetime),
      cancelAtPeriodEnd: false,
      activationSource: params.provider,
      paymentProvider: params.provider,
      paymentVerified: true,
      lastPaymentRef: params.paymentRef,
      updatedAt: now
    };
    this.recordActivation({
      uid: params.uid,
      email: params.email || existing.email || null,
      plan: params.plan,
      billingCycle: params.billingCycle,
      source: params.provider,
      code: params.code || null,
      startDate: baseStart,
      endDate: computedEndDate,
      isLifetime: Boolean(params.isLifetime),
      activatedAt: now
    });
    this.appendSubscriptionHistory(params.uid, {
      action: "activate",
      oldPlan: existing.plan || "FREE",
      newPlan: params.plan,
      oldStatus: existing.status || "active",
      newStatus: "active",
      startDate: baseStart,
      endDate: computedEndDate,
      isLifetime: Boolean(params.isLifetime),
      source: params.provider,
      reason: params.code ? `Activation via code Redeem ${params.code}` : `Activation ${params.provider}`,
      timestamp: now
    });
    this.addAudit(
      params.uid,
      "SUBSCRIPTION_ACTIVATED",
      `Plan ${params.plan} (${params.billingCycle}) verified via ${params.provider} ref=${params.paymentRef}`
    );
    this.persist();
    return this.getUserSubscription(params.uid);
  }
  scheduleCancellation(uid) {
    const now = Date.now();
    const record = this.data.subscriptions[uid];
    if (!record || record.plan === "FREE") {
      return this.getUserSubscription(uid);
    }
    record.cancelAtPeriodEnd = true;
    record.updatedAt = now;
    this.addAudit(uid, "SUBSCRIPTION_CANCEL_SCHEDULED", `Cancellation scheduled at period end for ${record.plan}`);
    this.persist();
    return this.getUserSubscription(uid);
  }
  // --- Pioneer / Early Tester Program ---
  grantEarlyTester(params) {
    const now = Date.now();
    const start = params.startDate || now;
    const days = params.durationDays || this.data.platformSettings.pioneerDurationDays || 730;
    const end = start + days * 24 * 60 * 60 * 1e3;
    if (params.email) {
      const cleanEmail = params.email.toLowerCase().trim();
      this.data.earlyTesterEmails[cleanEmail] = { startDate: start, endDate: end, note: params.note };
      Object.values(this.data.subscriptions).forEach((sub) => {
        if ((sub.email || "").toLowerCase().trim() === cleanEmail) {
          sub.isEarlyTester = true;
          sub.earlyTesterStartDate = start;
          sub.earlyTesterEndDate = end;
          sub.paymentProvider = sub.paymentProvider || "early_tester";
          sub.activationSource = sub.activationSource || "pioneer";
          sub.updatedAt = now;
        }
      });
    }
    let resolvedUid = params.uid;
    if (!resolvedUid && params.email) {
      const clean = params.email.toLowerCase().trim();
      const matched = Object.values(this.data.userDirectory).find(
        (u) => (u.email || "").toLowerCase().trim() === clean
      );
      if (matched) resolvedUid = matched.uid;
    }
    let updated = null;
    if (resolvedUid) {
      const existing = this.data.subscriptions[resolvedUid] || {
        uid: resolvedUid,
        plan: "FREE",
        status: "active",
        billingCycle: "monthly",
        startDate: now,
        endDate: null,
        cancelAtPeriodEnd: false
      };
      this.data.subscriptions[resolvedUid] = {
        ...existing,
        uid: resolvedUid,
        email: params.email || existing.email || null,
        isEarlyTester: true,
        earlyTesterStartDate: start,
        earlyTesterEndDate: end,
        activationSource: "pioneer",
        paymentProvider: existing.paymentProvider || "early_tester",
        updatedAt: now
      };
      this.recordActivation({
        uid: resolvedUid,
        email: params.email || existing.email || null,
        plan: "PREMIUM",
        billingCycle: "annual",
        source: "pioneer",
        code: null,
        startDate: start,
        endDate: end,
        reason: params.note || "Programme Pioneer",
        adminEmail: params.adminEmail,
        activatedAt: now
      });
    }
    this.recordAuditLog({
      adminUid: params.adminUid || "admin",
      adminEmail: params.adminEmail || "admin",
      adminRole: "SUPER_ADMIN",
      action: "PIONEER_GRANTED",
      category: "pioneer",
      targetUid: resolvedUid || null,
      targetEmail: params.email || null,
      newValue: { startDate: start, endDate: end, days },
      ip: params.ip,
      detail: `Acc\xE8s Pioneer (${days} jours Premium gratuit) attribu\xE9 \xE0 ${params.email || resolvedUid}`
    });
    this.persist();
    if (resolvedUid) {
      updated = this.getUserSubscription(resolvedUid);
    }
    return updated;
  }
  revokePioneerAccess(params) {
    const now = Date.now();
    if (params.email) {
      delete this.data.earlyTesterEmails[params.email.toLowerCase().trim()];
    }
    if (params.uid && this.data.subscriptions[params.uid]) {
      const sub = this.data.subscriptions[params.uid];
      sub.isEarlyTester = false;
      sub.earlyTesterEndDate = now;
      sub.updatedAt = now;
    }
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "PIONEER_REVOKED",
      category: "pioneer",
      targetUid: params.uid || null,
      targetEmail: params.email || null,
      ip: params.ip,
      detail: `Avantage Pioneer retir\xE9 (${params.email || params.uid}). Motif : ${params.reason}`
    });
    this.persist();
  }
  listPioneerData() {
    const allUsers = this.listAllUsersSummary();
    const pioneers = allUsers.filter((u) => u.subscription.isEarlyTester);
    const whitelistedEmails = Object.entries(this.data.earlyTesterEmails).map(([email, info]) => ({
      email,
      ...info
    }));
    return { pioneers, whitelistedEmails };
  }
  // --- Family Profiles Management ---
  getFamilyProfiles(ownerUid) {
    return this.data.familyProfiles[ownerUid] || [];
  }
  addFamilyProfile(ownerUid, payload, maxMembers) {
    const existing = this.data.familyProfiles[ownerUid] || [];
    if (existing.length >= maxMembers) {
      throw new Error(`Limite de ${maxMembers} profils familiaux atteinte pour cet abonnement.`);
    }
    const now = Date.now();
    const profile = {
      id: `fam_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      ownerUid,
      memberUid: null,
      name: payload.name.trim(),
      relation: payload.relation,
      vruType: payload.vruType || "PEDESTRIAN" /* PEDESTRIAN */,
      shareLocation: payload.shareLocation ?? true,
      sosAlertsEnabled: payload.sosAlertsEnabled ?? true,
      geofenceAlertEnabled: payload.geofenceAlertEnabled ?? false,
      speedAlertThresholdKmh: payload.speedAlertThresholdKmh ?? 25,
      emergencyContactPhone: payload.emergencyContactPhone?.trim() || "",
      status: "active",
      createdAt: now,
      updatedAt: now
    };
    this.data.familyProfiles[ownerUid] = [...existing, profile];
    this.addAudit(ownerUid, "FAMILY_PROFILE_ADDED", `Added family member profile ${profile.name}`);
    this.persist();
    return profile;
  }
  updateFamilyProfile(ownerUid, profileId, updates) {
    const list = this.data.familyProfiles[ownerUid] || [];
    const idx = list.findIndex((p) => p.id === profileId);
    if (idx === -1) {
      throw new Error("Profil familial introuvable.");
    }
    const updated = {
      ...list[idx],
      ...updates,
      updatedAt: Date.now()
    };
    list[idx] = updated;
    this.data.familyProfiles[ownerUid] = list;
    this.persist();
    return updated;
  }
  removeFamilyProfile(ownerUid, profileId) {
    const list = this.data.familyProfiles[ownerUid] || [];
    this.data.familyProfiles[ownerUid] = list.filter((p) => p.id !== profileId);
    this.persist();
  }
  // --- Business Quotes ---
  createBusinessQuote(input) {
    const quote = {
      ...input,
      id: `biz_${Date.now()}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      status: "new",
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.data.businessQuotes.unshift(quote);
    this.persist();
    return quote;
  }
  updateBusinessQuote(params) {
    const quote = this.data.businessQuotes.find((q) => q.id === params.id);
    if (!quote) throw new Error("Demande Business introuvable.");
    if (params.status) quote.status = params.status;
    if (params.internalNote !== void 0) quote.internalNote = params.internalNote;
    quote.updatedAt = Date.now();
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "BUSINESS_QUOTE_UPDATED",
      category: "support",
      targetId: quote.id,
      detail: `Devis ${quote.companyName} mis \xE0 jour (${quote.status})`
    });
    this.persist();
    return quote;
  }
  listAllSubscriptionsForAdmin() {
    return Object.keys(this.data.subscriptions).map((uid) => this.getUserSubscription(uid));
  }
  listBusinessQuotesForAdmin() {
    return this.data.businessQuotes;
  }
  // --- Redeem Codes (Cryptographic + Hashed + Masked + Atomic Lock) ---
  normalizeCode(rawCode) {
    return rawCode.trim().toUpperCase().replace(/\s+/g, "");
  }
  generateRandomChunk(length) {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = import_crypto2.default.randomBytes(length);
    let out = "";
    for (let i = 0; i < length; i++) {
      out += alphabet[bytes[i] % alphabet.length];
    }
    return out;
  }
  generateRedeemCodes(params) {
    const safeCount = Math.min(100, Math.max(1, Math.floor(params.count || 1)));
    const safeMaxUses = Math.min(1e3, Math.max(1, Math.floor(params.maxUses || 1)));
    const durationCode = params.durationCode || (params.billingCycle === "annual" ? "12m" : "1m");
    const durationDays = resolveDurationDaysForRedeem(durationCode);
    const isLifetime = durationCode === "lifetime";
    const billingCycle = durationCode === "12m" || durationCode === "24m" ? "annual" : durationCode === "1m" ? "monthly" : "custom";
    const prefix = params.plan === "FAMILY" ? "VRU-FAM" : params.plan === "BUSINESS" ? "VRU-BIZ" : "VRU-PREM";
    const now = Date.now();
    const plaintextCreated = [];
    for (let i = 0; i < safeCount; i++) {
      let plainCode = "";
      let codeHash = "";
      let guard = 0;
      do {
        plainCode = `${prefix}-${this.generateRandomChunk(4)}-${this.generateRandomChunk(4)}-${this.generateRandomChunk(4)}`;
        codeHash = hashRedeemCode(plainCode);
        guard++;
      } while ((this.data.redeemCodes[codeHash] || this.data.redeemCodes[plainCode]) && guard < 10);
      const id = `rc_${now}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
      const maskedCode = maskRedeemCode(plainCode);
      const storedRecord = {
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
        status: "available",
        createdAt: now,
        createdBy: params.createdBy,
        campaign: params.campaign?.trim() || void 0,
        note: params.note?.trim() || void 0,
        usedByUid: null,
        usedByEmail: null,
        usedAt: null,
        usageHistory: []
      };
      this.data.redeemCodes[id] = storedRecord;
      plaintextCreated.push({
        ...storedRecord,
        code: plainCode
      });
    }
    this.recordAuditLog({
      adminUid: params.adminUid || params.createdBy,
      adminEmail: params.createdBy,
      adminRole: "SUPER_ADMIN",
      action: "REDEEM_CODES_GENERATED",
      category: "redeem",
      newValue: {
        count: plaintextCreated.length,
        plan: params.plan,
        durationCode,
        maxUses: safeMaxUses,
        campaign: params.campaign || null
      },
      ip: params.ip,
      detail: `G\xE9n\xE9ration de ${plaintextCreated.length} code(s) Redeem ${params.plan} (${durationCode}, maxUses=${safeMaxUses})`
    });
    this.persist();
    return plaintextCreated;
  }
  findRedeemRecordByInput(normalizedCode) {
    const hash = hashRedeemCode(normalizedCode);
    if (this.data.redeemCodes[normalizedCode]) return this.data.redeemCodes[normalizedCode];
    return Object.values(this.data.redeemCodes).find(
      (rec) => rec.codeHash === hash || rec.code === normalizedCode
    );
  }
  redeemCodeForUser(params) {
    const normalized = this.normalizeCode(params.code || "");
    if (!normalized) {
      throw new Error("Veuillez saisir un code Redeem valide.");
    }
    const lockKey = hashRedeemCode(normalized);
    if (this.redeemLocks.has(lockKey)) {
      throw new Error("Traitement simultan\xE9 d\xE9tect\xE9. Veuillez r\xE9essayer dans un instant.");
    }
    this.redeemLocks.add(lockKey);
    try {
      const codeRecord = this.findRedeemRecordByInput(normalized);
      if (!codeRecord) {
        throw new Error("Code Redeem introuvable. V\xE9rifiez la saisie ou contactez un administrateur.");
      }
      const now = Date.now();
      if (codeRecord.expiresAt && codeRecord.expiresAt <= now) {
        codeRecord.status = "expired";
        this.persist();
        throw new Error("Ce code Redeem est expir\xE9.");
      }
      if (codeRecord.status === "revoked") {
        throw new Error("Ce code Redeem a \xE9t\xE9 r\xE9voqu\xE9 par un administrateur.");
      }
      if (codeRecord.status === "disabled") {
        throw new Error("Ce code Redeem est temporairement d\xE9sactiv\xE9.");
      }
      if (codeRecord.status === "expired") {
        throw new Error("Ce code Redeem est expir\xE9.");
      }
      const maxUses = codeRecord.maxUses || 1;
      const currentUses = codeRecord.usesCount ?? (codeRecord.status === "used" ? 1 : 0);
      if (codeRecord.status === "used" || currentUses >= maxUses) {
        throw new Error("Ce code Redeem a d\xE9j\xE0 atteint sa limite d\u2019utilisation.");
      }
      if ((codeRecord.usageHistory || []).some((entry) => entry.uid === params.uid) || codeRecord.usedByUid === params.uid) {
        throw new Error("Vous avez d\xE9j\xE0 utilis\xE9 ce code Redeem sur votre compte.");
      }
      if (params.expectedPlan && codeRecord.plan !== params.expectedPlan) {
        throw new Error(
          `Ce code correspond \xE0 l'abonnement ${codeRecord.plan}. S\xE9lectionnez la formule ${codeRecord.plan} pour l'activer.`
        );
      }
      if (!this.isPlanEnabled(codeRecord.plan)) {
        throw new Error(`La formule ${codeRecord.plan} est actuellement d\xE9sactiv\xE9e par l\u2019administration.`);
      }
      const nextUses = currentUses + 1;
      codeRecord.usesCount = nextUses;
      codeRecord.usedByUid = params.uid;
      codeRecord.usedByEmail = params.email || null;
      codeRecord.usedAt = now;
      codeRecord.usageHistory = [
        ...codeRecord.usageHistory || [],
        { uid: params.uid, email: params.email || null, usedAt: now }
      ];
      if (nextUses >= maxUses) {
        codeRecord.status = "used";
      }
      const prices = this.data.platformSettings.planPrices;
      const amountTnd = codeRecord.plan === "FAMILY" ? codeRecord.billingCycle === "annual" ? prices.familyAnnualTnd : prices.familyMonthlyTnd : codeRecord.plan === "PREMIUM" ? codeRecord.billingCycle === "annual" ? prices.premiumAnnualTnd : prices.premiumMonthlyTnd : 0;
      const maskedLabel = codeRecord.maskedCode || maskRedeemCode(normalized);
      const subscription = this.activateVerifiedSubscription({
        uid: params.uid,
        email: params.email || null,
        plan: codeRecord.plan,
        billingCycle: codeRecord.billingCycle,
        provider: "redeem",
        paymentRef: maskedLabel,
        amount: amountTnd,
        currency: "TND",
        code: maskedLabel,
        durationDays: codeRecord.durationDays,
        isLifetime: Boolean(codeRecord.isLifetime)
      });
      const activation = this.data.activations.find(
        (a) => a.uid === params.uid && a.code === maskedLabel
      ) || {
        id: `act_${now}`,
        uid: params.uid,
        email: params.email || null,
        plan: codeRecord.plan,
        billingCycle: codeRecord.billingCycle,
        source: "redeem",
        code: maskedLabel,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        isLifetime: Boolean(codeRecord.isLifetime),
        activatedAt: now
      };
      this.recordAuditLog({
        adminUid: params.uid,
        adminEmail: params.email || params.uid,
        adminRole: "USER",
        action: "REDEEM_CODE_REDEEMED",
        category: "redeem",
        targetUid: params.uid,
        targetEmail: params.email || null,
        targetId: codeRecord.id || maskedLabel,
        newValue: { plan: codeRecord.plan, durationCode: codeRecord.durationCode || codeRecord.billingCycle },
        detail: `Code ${maskedLabel} utilis\xE9 par ${params.email || params.uid} (${codeRecord.plan})`
      });
      this.persist();
      return {
        subscription,
        activation,
        codeRecord: { ...codeRecord, code: maskedLabel }
      };
    } finally {
      this.redeemLocks.delete(lockKey);
    }
  }
  updateRedeemCodeStatus(params) {
    const trimmed = params.idOrCode.trim();
    const record = this.data.redeemCodes[trimmed] || this.data.redeemCodes[this.normalizeCode(trimmed)] || Object.values(this.data.redeemCodes).find(
      (r) => r.id === trimmed || r.maskedCode === trimmed || r.code === trimmed
    );
    if (!record) {
      throw new Error("Code Redeem introuvable.");
    }
    if (record.status === "used" && params.action !== "enable") {
      throw new Error("Ce code a d\xE9j\xE0 \xE9t\xE9 enti\xE8rement utilis\xE9.");
    }
    const oldStatus = record.status;
    if (params.action === "revoke") {
      record.status = "revoked";
    } else if (params.action === "disable") {
      record.status = "disabled";
    } else if (params.action === "enable") {
      if (record.expiresAt && record.expiresAt <= Date.now()) {
        throw new Error("Impossible de r\xE9activer un code expir\xE9.");
      }
      record.status = (record.usesCount || 0) >= (record.maxUses || 1) ? "used" : "available";
    }
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: `REDEEM_CODE_${params.action.toUpperCase()}`,
      category: "redeem",
      targetId: record.id || record.code,
      oldValue: { status: oldStatus },
      newValue: { status: record.status },
      ip: params.ip,
      detail: `Code ${record.maskedCode || maskRedeemCode(record.code)} : ${oldStatus} -> ${record.status}`
    });
    this.persist();
    return this.sanitizeRedeemForAdmin(record);
  }
  revokeRedeemCode(rawCode, adminEmail) {
    return this.updateRedeemCodeStatus({
      idOrCode: rawCode,
      action: "revoke",
      adminUid: adminEmail,
      adminEmail
    });
  }
  sanitizeRedeemForAdmin(rec) {
    const now = Date.now();
    let computedStatus = rec.status;
    if (computedStatus === "available" && rec.expiresAt && rec.expiresAt <= now) {
      computedStatus = "expired";
    }
    const masked = rec.maskedCode || maskRedeemCode(rec.code);
    return {
      ...rec,
      id: rec.id || rec.code,
      code: masked,
      maskedCode: masked,
      codeHash: void 0,
      status: computedStatus
    };
  }
  listRedeemCodesForAdmin() {
    return Object.values(this.data.redeemCodes).map((rec) => this.sanitizeRedeemForAdmin(rec)).sort((a, b) => b.createdAt - a.createdAt);
  }
  listRecentActivationsForAdmin(limit = 50) {
    return this.data.activations.slice().sort((a, b) => b.activatedAt - a.activatedAt).slice(0, limit);
  }
  // --- Accessibility Program (Free Lifetime Premium upon Document Review) ---
  submitAccessibilityRequest(params) {
    if (!this.data.platformSettings.accessibilityProgramEnabled) {
      throw new Error("Le programme Accessibilit\xE9 est temporairement ferm\xE9 aux nouvelles demandes.");
    }
    const existingPending = this.data.accessibilityRequests.find(
      (r) => r.uid === params.uid && (r.status === "pending" || r.status === "more_info_required")
    );
    const now = Date.now();
    const id = existingPending ? existingPending.id : `acc_${now}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
    let storagePath = existingPending?.documentStoragePath || null;
    let docSize = existingPending?.documentSize || 0;
    if (params.documentBase64) {
      if (!import_fs2.default.existsSync(ACCESSIBILITY_DOCS_DIR)) {
        import_fs2.default.mkdirSync(ACCESSIBILITY_DOCS_DIR, { recursive: true });
      }
      const cleanBase64 = params.documentBase64.replace(/^data:[^;]+;base64,/, "");
      const buf = Buffer.from(cleanBase64, "base64");
      if (buf.length > 8 * 1024 * 1024) {
        throw new Error("Le justificatif ne doit pas d\xE9passer 8 Mo.");
      }
      const safeExt = import_path2.default.extname(params.documentName || "").replace(/[^a-zA-Z0-9.]/g, "").slice(0, 10) || ".bin";
      const filename = `${id}_${now}${safeExt}`;
      storagePath = import_path2.default.join(ACCESSIBILITY_DOCS_DIR, filename);
      import_fs2.default.writeFileSync(storagePath, buf);
      docSize = buf.length;
    }
    if (existingPending) {
      existingPending.fullName = params.fullName.trim();
      existingPending.disabilityCategory = params.disabilityCategory.trim();
      existingPending.description = params.description.trim();
      if (params.documentName) existingPending.documentName = params.documentName;
      if (params.documentMimeType) existingPending.documentMimeType = params.documentMimeType;
      existingPending.documentSize = docSize;
      existingPending.documentStoragePath = storagePath;
      existingPending.hasDocumentFile = Boolean(storagePath);
      existingPending.status = "pending";
      existingPending.updatedAt = now;
      existingPending.history.unshift({
        action: "RESUBMITTED",
        actor: params.email || params.uid,
        comment: "Compl\xE9ment de dossier transmis",
        timestamp: now
      });
      this.persist();
      return this.stripAccessibilityPrivatePath(existingPending);
    }
    const record = {
      id,
      uid: params.uid,
      email: params.email,
      displayName: params.displayName,
      fullName: params.fullName.trim(),
      disabilityCategory: params.disabilityCategory.trim(),
      description: params.description.trim(),
      documentName: params.documentName || "justificatif",
      documentMimeType: params.documentMimeType || "application/octet-stream",
      documentSize: docSize,
      documentStoragePath: storagePath,
      hasDocumentFile: Boolean(storagePath),
      status: "pending",
      adminComment: null,
      reviewedBy: null,
      reviewedAt: null,
      createdAt: now,
      updatedAt: now,
      history: [
        {
          action: "SUBMITTED",
          actor: params.email || params.uid,
          comment: "Demande initiale soumise",
          timestamp: now
        }
      ]
    };
    this.data.accessibilityRequests.unshift(record);
    this.recordAuditLog({
      adminUid: params.uid,
      adminEmail: params.email || params.uid,
      adminRole: "USER",
      action: "ACCESSIBILITY_REQUEST_SUBMITTED",
      category: "accessibility",
      targetUid: params.uid,
      targetEmail: params.email,
      targetId: record.id,
      detail: `Nouvelle demande programme Accessibilit\xE9 (${record.disabilityCategory})`
    });
    this.persist();
    return this.stripAccessibilityPrivatePath(record);
  }
  stripAccessibilityPrivatePath(rec) {
    const { documentStoragePath: _ignored, ...safe } = rec;
    return safe;
  }
  listAccessibilityRequests(uid) {
    return this.data.accessibilityRequests.filter((r) => !uid ? true : r.uid === uid).map((r) => this.stripAccessibilityPrivatePath(r)).sort((a, b) => b.createdAt - a.createdAt);
  }
  upsertExternalAccessibilityRequest(rec) {
    if (!rec || !rec.id || !rec.uid) return;
    const existing = this.data.accessibilityRequests.find((r) => r.id === rec.id);
    if (!existing) {
      this.data.accessibilityRequests.unshift({
        ...rec,
        documentStoragePath: null,
        history: Array.isArray(rec.history) ? rec.history : []
      });
      this.persist();
      return;
    }
    if ((rec.updatedAt || 0) > (existing.updatedAt || 0)) {
      existing.fullName = rec.fullName || existing.fullName;
      existing.disabilityCategory = rec.disabilityCategory || existing.disabilityCategory;
      existing.description = rec.description || existing.description;
      existing.documentName = rec.documentName || existing.documentName;
      existing.documentMimeType = rec.documentMimeType || existing.documentMimeType;
      existing.documentSize = rec.documentSize ?? existing.documentSize;
      existing.hasDocumentFile = Boolean(existing.hasDocumentFile || rec.hasDocumentFile);
      existing.status = rec.status || existing.status;
      existing.adminComment = rec.adminComment ?? existing.adminComment;
      existing.reviewedBy = rec.reviewedBy ?? existing.reviewedBy;
      existing.reviewedAt = rec.reviewedAt ?? existing.reviewedAt;
      existing.updatedAt = rec.updatedAt || existing.updatedAt;
      if (Array.isArray(rec.history) && rec.history.length > (existing.history?.length || 0)) {
        existing.history = rec.history;
      }
      this.persist();
    }
  }
  getAccessibilityDocumentFile(requestId) {
    const rec = this.data.accessibilityRequests.find((r) => r.id === requestId);
    if (!rec || !rec.documentStoragePath || !import_fs2.default.existsSync(rec.documentStoragePath)) {
      return null;
    }
    return {
      filePath: rec.documentStoragePath,
      mimeType: rec.documentMimeType || "application/octet-stream",
      fileName: rec.documentName || "justificatif"
    };
  }
  reviewAccessibilityRequest(params) {
    const rec = this.data.accessibilityRequests.find((r) => r.id === params.requestId);
    if (!rec) {
      throw new Error("Demande Accessibilit\xE9 introuvable.");
    }
    const now = Date.now();
    const oldStatus = rec.status;
    rec.status = params.decision;
    rec.adminComment = params.comment?.trim() || null;
    rec.reviewedBy = params.adminEmail;
    rec.reviewedAt = now;
    rec.updatedAt = now;
    rec.history.unshift({
      action: params.decision.toUpperCase(),
      actor: params.adminEmail,
      comment: rec.adminComment || void 0,
      timestamp: now
    });
    let subscription;
    if (params.decision === "approved") {
      subscription = this.adminUpdateUserSubscription({
        targetUid: rec.uid,
        targetEmail: rec.email,
        action: "grant_lifetime",
        plan: "PREMIUM",
        isLifetime: true,
        activationType: "accessibility",
        reason: `Programme Accessibilit\xE9 approuv\xE9 (${rec.id})`,
        adminUid: params.adminUid,
        adminEmail: params.adminEmail,
        ip: params.ip
      });
      this.createAdminNotification({
        title: "Programme Accessibilit\xE9 approuv\xE9",
        message: "Votre demande au programme Accessibilit\xE9 a \xE9t\xE9 valid\xE9e. Votre abonnement VruGuard Premium gratuit \xE0 vie est d\xE9sormais actif.",
        type: "success",
        targetScope: "specific_user",
        targetUid: rec.uid,
        targetEmail: rec.email,
        createdBy: params.adminEmail,
        adminUid: params.adminUid
      });
    } else if (params.decision === "more_info_required") {
      this.createAdminNotification({
        title: "Compl\xE9ment requis \u2014 Programme Accessibilit\xE9",
        message: params.comment || "Notre \xE9quipe a besoin d\u2019un justificatif compl\xE9mentaire pour finaliser l\u2019examen de votre dossier Accessibilit\xE9.",
        type: "warning",
        targetScope: "specific_user",
        targetUid: rec.uid,
        targetEmail: rec.email,
        createdBy: params.adminEmail,
        adminUid: params.adminUid
      });
    } else if (params.decision === "rejected") {
      this.createAdminNotification({
        title: "R\xE9ponse Programme Accessibilit\xE9",
        message: params.comment || "Votre demande au programme Accessibilit\xE9 n\u2019a pas pu \xEAtre valid\xE9e en l\u2019\xE9tat.",
        type: "info",
        targetScope: "specific_user",
        targetUid: rec.uid,
        targetEmail: rec.email,
        createdBy: params.adminEmail,
        adminUid: params.adminUid
      });
    }
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: `ACCESSIBILITY_${params.decision.toUpperCase()}`,
      category: "accessibility",
      targetUid: rec.uid,
      targetEmail: rec.email,
      targetId: rec.id,
      oldValue: { status: oldStatus },
      newValue: { status: rec.status, comment: rec.adminComment },
      ip: params.ip,
      detail: `Dossier Accessibilit\xE9 ${rec.id} (${rec.email || rec.uid}) : ${oldStatus} -> ${rec.status}`
    });
    this.persist();
    return {
      request: this.stripAccessibilityPrivatePath(rec),
      subscription
    };
  }
  // --- Platform Settings & Multi-Currency Pricing ---
  isPlanEnabled(plan) {
    const regional = this.data.platformSettings.regionalPlans?.[plan];
    if (!regional) return true;
    return regional.enabled !== false;
  }
  getPlanAmount(plan, billingCycle, currency) {
    const regional = this.data.platformSettings.regionalPlans?.[plan];
    const prices = this.data.platformSettings.planPrices;
    let raw;
    if (plan === "PREMIUM") {
      raw = currency === "TND" ? billingCycle === "annual" ? regional?.annualPriceTnd ?? prices.premiumAnnualTnd : regional?.monthlyPriceTnd ?? prices.premiumMonthlyTnd : billingCycle === "annual" ? regional?.annualPriceEur ?? prices.premiumAnnualEur : regional?.monthlyPriceEur ?? prices.premiumMonthlyEur;
    } else if (plan === "FAMILY") {
      raw = currency === "TND" ? billingCycle === "annual" ? regional?.annualPriceTnd ?? prices.familyAnnualTnd : regional?.monthlyPriceTnd ?? prices.familyMonthlyTnd : billingCycle === "annual" ? regional?.annualPriceEur ?? prices.familyAnnualEur : regional?.monthlyPriceEur ?? prices.familyMonthlyEur;
    } else if (plan === "FREE") {
      raw = 0;
    } else {
      raw = null;
    }
    if (raw === null || raw === void 0 || !Number.isFinite(raw) || raw <= 0) {
      throw new Error("Ce plan n\xE9cessite un devis personnalis\xE9 ou n\u2019est pas tarif\xE9.");
    }
    return raw;
  }
  getPriceChangeHistory(limit = 150) {
    return this.data.priceChangeHistory.slice(0, limit);
  }
  getPlatformSettings() {
    return this.data.platformSettings;
  }
  getPublicPlatformConfig() {
    const s = this.data.platformSettings;
    return {
      platformName: s.platformName,
      logoUrl: s.logoUrl,
      contactEmail: s.contactEmail,
      supportEmail: s.supportEmail,
      planPrices: s.planPrices,
      regionalPlans: s.regionalPlans,
      pioneerProgramEnabled: s.pioneerProgramEnabled,
      accessibilityProgramEnabled: s.accessibilityProgramEnabled,
      maintenanceMode: s.maintenanceMode,
      maintenanceMessage: s.maintenanceMessage,
      announcementEnabled: s.announcementEnabled,
      announcementText: s.announcementText,
      announcementType: s.announcementType
    };
  }
  appendPriceHistoryEntry(entry) {
    this.data.priceChangeHistory.unshift({
      id: `prc_${Date.now()}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      timestamp: Date.now(),
      ...entry
    });
    if (this.data.priceChangeHistory.length > 1e3) {
      this.data.priceChangeHistory.length = 1e3;
    }
  }
  updatePlatformSettings(params) {
    const oldSettings = JSON.parse(JSON.stringify(this.data.platformSettings));
    const oldRegional = normalizeRegionalPlansFromSettings(
      oldSettings.planPrices,
      oldSettings.regionalPlans
    );
    const u = params.updates;
    const reason = typeof u.reason === "string" && u.reason.trim() ? u.reason.trim().slice(0, 240) : void 0;
    if (u.platformName !== void 0) {
      this.data.platformSettings.platformName = String(u.platformName).slice(0, 80) || "VruGuard";
    }
    if (u.logoUrl !== void 0) {
      this.data.platformSettings.logoUrl = String(u.logoUrl).slice(0, 500);
    }
    if (u.contactEmail !== void 0) {
      this.data.platformSettings.contactEmail = String(u.contactEmail).slice(0, 150);
    }
    if (u.supportEmail !== void 0) {
      this.data.platformSettings.supportEmail = String(u.supportEmail).slice(0, 150);
    }
    const sanitizePrice = (val, fallback) => {
      const n = Number(val);
      if (!Number.isFinite(n) || n < 0) return fallback;
      return Math.round(n * 100) / 100;
    };
    if (u.planPrices) {
      this.data.platformSettings.planPrices = {
        premiumMonthlyTnd: sanitizePrice(u.planPrices.premiumMonthlyTnd, oldSettings.planPrices.premiumMonthlyTnd),
        premiumAnnualTnd: sanitizePrice(u.planPrices.premiumAnnualTnd, oldSettings.planPrices.premiumAnnualTnd),
        premiumMonthlyEur: sanitizePrice(u.planPrices.premiumMonthlyEur, oldSettings.planPrices.premiumMonthlyEur),
        premiumAnnualEur: sanitizePrice(u.planPrices.premiumAnnualEur, oldSettings.planPrices.premiumAnnualEur),
        familyMonthlyTnd: sanitizePrice(u.planPrices.familyMonthlyTnd, oldSettings.planPrices.familyMonthlyTnd),
        familyAnnualTnd: sanitizePrice(u.planPrices.familyAnnualTnd, oldSettings.planPrices.familyAnnualTnd),
        familyMonthlyEur: sanitizePrice(u.planPrices.familyMonthlyEur, oldSettings.planPrices.familyMonthlyEur),
        familyAnnualEur: sanitizePrice(u.planPrices.familyAnnualEur, oldSettings.planPrices.familyAnnualEur)
      };
    }
    if (u.regionalPlans) {
      const currentReg = normalizeRegionalPlansFromSettings(
        this.data.platformSettings.planPrices,
        this.data.platformSettings.regionalPlans
      );
      const nextPrem = u.regionalPlans.PREMIUM;
      const nextFam = u.regionalPlans.FAMILY;
      if (nextPrem) {
        this.data.platformSettings.planPrices.premiumMonthlyTnd = sanitizePrice(
          nextPrem.monthlyPriceTnd,
          this.data.platformSettings.planPrices.premiumMonthlyTnd
        );
        this.data.platformSettings.planPrices.premiumAnnualTnd = sanitizePrice(
          nextPrem.annualPriceTnd,
          this.data.platformSettings.planPrices.premiumAnnualTnd
        );
        this.data.platformSettings.planPrices.premiumMonthlyEur = sanitizePrice(
          nextPrem.monthlyPriceEur,
          this.data.platformSettings.planPrices.premiumMonthlyEur
        );
        this.data.platformSettings.planPrices.premiumAnnualEur = sanitizePrice(
          nextPrem.annualPriceEur,
          this.data.platformSettings.planPrices.premiumAnnualEur
        );
      }
      if (nextFam) {
        this.data.platformSettings.planPrices.familyMonthlyTnd = sanitizePrice(
          nextFam.monthlyPriceTnd,
          this.data.platformSettings.planPrices.familyMonthlyTnd
        );
        this.data.platformSettings.planPrices.familyAnnualTnd = sanitizePrice(
          nextFam.annualPriceTnd,
          this.data.platformSettings.planPrices.familyAnnualTnd
        );
        this.data.platformSettings.planPrices.familyMonthlyEur = sanitizePrice(
          nextFam.monthlyPriceEur,
          this.data.platformSettings.planPrices.familyMonthlyEur
        );
        this.data.platformSettings.planPrices.familyAnnualEur = sanitizePrice(
          nextFam.annualPriceEur,
          this.data.platformSettings.planPrices.familyAnnualEur
        );
      }
      const mergedRegional = {
        FREE: {
          ...currentReg.FREE,
          enabled: u.regionalPlans.FREE?.enabled ?? currentReg.FREE.enabled
        },
        PREMIUM: {
          ...currentReg.PREMIUM,
          enabled: nextPrem?.enabled ?? currentReg.PREMIUM.enabled,
          monthlyPriceTnd: this.data.platformSettings.planPrices.premiumMonthlyTnd,
          annualPriceTnd: this.data.platformSettings.planPrices.premiumAnnualTnd,
          monthlyPriceEur: this.data.platformSettings.planPrices.premiumMonthlyEur,
          annualPriceEur: this.data.platformSettings.planPrices.premiumAnnualEur
        },
        FAMILY: {
          ...currentReg.FAMILY,
          enabled: nextFam?.enabled ?? currentReg.FAMILY.enabled,
          monthlyPriceTnd: this.data.platformSettings.planPrices.familyMonthlyTnd,
          annualPriceTnd: this.data.platformSettings.planPrices.familyAnnualTnd,
          monthlyPriceEur: this.data.platformSettings.planPrices.familyMonthlyEur,
          annualPriceEur: this.data.platformSettings.planPrices.familyAnnualEur
        },
        BUSINESS: {
          ...currentReg.BUSINESS,
          enabled: u.regionalPlans.BUSINESS?.enabled ?? currentReg.BUSINESS.enabled
        }
      };
      this.data.platformSettings.regionalPlans = mergedRegional;
    } else {
      this.data.platformSettings.regionalPlans = normalizeRegionalPlansFromSettings(
        this.data.platformSettings.planPrices,
        this.data.platformSettings.regionalPlans
      );
    }
    const newRegional = this.data.platformSettings.regionalPlans;
    ["FREE", "PREMIUM", "FAMILY", "BUSINESS"].forEach((planId) => {
      const prev = oldRegional[planId];
      const next = newRegional[planId];
      if (prev.enabled !== next.enabled) {
        this.appendPriceHistoryEntry({
          plan: planId,
          field: "enabled",
          currency: null,
          oldValue: prev.enabled,
          newValue: next.enabled,
          adminUid: params.adminUid,
          adminEmail: params.adminEmail,
          reason
        });
      }
      const trackedFields = [
        { key: "monthlyPriceTnd", currency: "TND" },
        { key: "annualPriceTnd", currency: "TND" },
        { key: "monthlyPriceEur", currency: "EUR" },
        { key: "annualPriceEur", currency: "EUR" }
      ];
      trackedFields.forEach(({ key, currency }) => {
        if (prev[key] !== next[key]) {
          this.appendPriceHistoryEntry({
            plan: planId,
            field: key,
            currency,
            oldValue: prev[key],
            newValue: next[key],
            adminUid: params.adminUid,
            adminEmail: params.adminEmail,
            reason
          });
        }
      });
    });
    if (u.pioneerProgramEnabled !== void 0) {
      this.data.platformSettings.pioneerProgramEnabled = Boolean(u.pioneerProgramEnabled);
    }
    if (u.pioneerDurationDays !== void 0) {
      this.data.platformSettings.pioneerDurationDays = Math.max(30, Math.min(3650, Number(u.pioneerDurationDays) || 730));
    }
    if (u.accessibilityProgramEnabled !== void 0) {
      this.data.platformSettings.accessibilityProgramEnabled = Boolean(u.accessibilityProgramEnabled);
    }
    if (u.notificationsEnabled !== void 0) {
      this.data.platformSettings.notificationsEnabled = Boolean(u.notificationsEnabled);
    }
    if (u.maintenanceMode !== void 0) {
      this.data.platformSettings.maintenanceMode = Boolean(u.maintenanceMode);
    }
    if (u.maintenanceMessage !== void 0) {
      this.data.platformSettings.maintenanceMessage = String(u.maintenanceMessage).slice(0, 500);
    }
    if (u.announcementEnabled !== void 0) {
      this.data.platformSettings.announcementEnabled = Boolean(u.announcementEnabled);
    }
    if (u.announcementText !== void 0) {
      this.data.platformSettings.announcementText = String(u.announcementText).slice(0, 500);
    }
    if (u.announcementType !== void 0) {
      this.data.platformSettings.announcementType = u.announcementType;
    }
    if (u.securitySettings) {
      const sec = this.data.platformSettings.securitySettings;
      if (u.securitySettings.requireReauthForCriticalActions !== void 0) {
        sec.requireReauthForCriticalActions = Boolean(u.securitySettings.requireReauthForCriticalActions);
      }
      if (u.securitySettings.adminRateLimitPerMin !== void 0) {
        sec.adminRateLimitPerMin = Math.max(20, Math.min(1e3, Number(u.securitySettings.adminRateLimitPerMin) || 120));
      }
      if (Array.isArray(u.securitySettings.delegatedAdminEmails)) {
        sec.delegatedAdminEmails = u.securitySettings.delegatedAdminEmails.map((e) => String(e).trim().toLowerCase()).filter((e) => e.includes("@") && !getSuperAdminEmails().includes(e));
      }
      if (u.securitySettings.permissionMatrix) {
        sec.permissionMatrix = u.securitySettings.permissionMatrix;
      }
    }
    this.data.platformSettings.updatedAt = Date.now();
    this.data.platformSettings.updatedBy = params.adminEmail;
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "PLATFORM_SETTINGS_UPDATED",
      category: "settings",
      oldValue: {
        maintenanceMode: oldSettings.maintenanceMode,
        announcementEnabled: oldSettings.announcementEnabled,
        planPrices: oldSettings.planPrices,
        regionalPlans: oldRegional
      },
      newValue: {
        maintenanceMode: this.data.platformSettings.maintenanceMode,
        announcementEnabled: this.data.platformSettings.announcementEnabled,
        planPrices: this.data.platformSettings.planPrices,
        regionalPlans: this.data.platformSettings.regionalPlans
      },
      ip: params.ip,
      detail: reason ? `Tarifs & param\xE8tres mis \xE0 jour par ${params.adminEmail} (${reason})` : `Param\xE8tres plateforme mis \xE0 jour par ${params.adminEmail}`
    });
    this.persist();
    return this.data.platformSettings;
  }
  // --- Admin Notifications ---
  createAdminNotification(params) {
    const now = Date.now();
    const users = this.listAllUsersSummary();
    let recipientCount = 0;
    if (params.targetScope === "specific_user") {
      recipientCount = 1;
    } else if (params.targetScope === "all") {
      recipientCount = users.length;
    } else {
      recipientCount = users.filter((u) => u.subscription.effectivePlan === params.targetScope).length;
    }
    const notif = {
      id: `notif_${now}_${import_crypto2.default.randomBytes(4).toString("hex")}`,
      title: params.title.trim().slice(0, 140),
      message: params.message.trim().slice(0, 1200),
      type: params.type || "info",
      targetScope: params.targetScope,
      targetUid: params.targetUid ?? null,
      targetEmail: params.targetEmail ?? null,
      createdBy: params.createdBy,
      createdAt: now,
      recipientCount,
      readByUids: []
    };
    this.data.adminNotifications.unshift(notif);
    if (this.data.adminNotifications.length > 500) {
      this.data.adminNotifications.length = 500;
    }
    this.recordAuditLog({
      adminUid: params.adminUid || params.createdBy,
      adminEmail: params.createdBy,
      adminRole: "SUPER_ADMIN",
      action: "ADMIN_NOTIFICATION_SENT",
      category: "notification",
      targetUid: params.targetUid ?? null,
      targetEmail: params.targetEmail ?? null,
      targetId: notif.id,
      newValue: { targetScope: notif.targetScope, type: notif.type, title: notif.title },
      ip: params.ip,
      detail: `Notification "${notif.title}" envoy\xE9e (cible=${notif.targetScope}, ~${recipientCount} destinataire(s))`
    });
    this.persist();
    return notif;
  }
  listAdminNotificationsForAdmin() {
    return this.data.adminNotifications.slice(0, 200);
  }
  getNotificationsForUser(uid, email, effectivePlan) {
    if (!this.data.platformSettings.notificationsEnabled) return [];
    const cleanEmail = (email || "").toLowerCase().trim();
    return this.data.adminNotifications.filter((n) => {
      if (n.readByUids.includes(uid)) return false;
      if (n.targetScope === "all") return true;
      if (n.targetScope === effectivePlan) return true;
      if (n.targetScope === "specific_user") {
        return n.targetUid === uid || cleanEmail && (n.targetEmail || "").toLowerCase().trim() === cleanEmail;
      }
      return false;
    }).slice(0, 20);
  }
  markNotificationRead(notifId, uid) {
    const notif = this.data.adminNotifications.find((n) => n.id === notifId);
    if (notif && !notif.readByUids.includes(uid)) {
      notif.readByUids.push(uid);
      this.persist();
    }
  }
  // --- Support Tickets ---
  createSupportTicket(params) {
    const now = Date.now();
    const ticket = {
      id: `tkt_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      uid: params.uid ?? null,
      email: params.email.trim().slice(0, 200),
      name: params.name.trim().slice(0, 120),
      subject: params.subject.trim().slice(0, 200),
      category: params.category || "support",
      priority: params.priority || "normal",
      message: params.message.trim().slice(0, 4e3),
      status: "open",
      createdAt: now,
      updatedAt: now,
      replies: [],
      internalNotes: []
    };
    this.data.supportTickets.unshift(ticket);
    this.persist();
    return ticket;
  }
  listSupportTickets(uid) {
    return this.data.supportTickets.filter((t) => !uid ? true : t.uid === uid).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  replySupportTicket(params) {
    const ticket = this.data.supportTickets.find((t) => t.id === params.ticketId);
    if (!ticket) throw new Error("Ticket support introuvable.");
    const now = Date.now();
    ticket.replies.push({
      id: `rep_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      senderRole: params.senderRole,
      senderEmail: params.senderEmail,
      message: params.message.trim().slice(0, 4e3),
      createdAt: now
    });
    if (params.senderRole === "admin" && ticket.status === "open") {
      ticket.status = "in_progress";
    }
    ticket.updatedAt = now;
    if (params.senderRole === "admin") {
      if (ticket.uid) {
        this.createAdminNotification({
          title: `R\xE9ponse support : ${ticket.subject}`,
          message: params.message.trim().slice(0, 400),
          type: "info",
          targetScope: "specific_user",
          targetUid: ticket.uid,
          targetEmail: ticket.email,
          createdBy: params.senderEmail,
          adminUid: params.adminUid
        });
      }
      this.recordAuditLog({
        adminUid: params.adminUid || params.senderEmail,
        adminEmail: params.senderEmail,
        adminRole: "SUPER_ADMIN",
        action: "SUPPORT_TICKET_REPLIED",
        category: "support",
        targetUid: ticket.uid,
        targetEmail: ticket.email,
        targetId: ticket.id,
        ip: params.ip,
        detail: `R\xE9ponse envoy\xE9e sur le ticket "${ticket.subject}"`
      });
    }
    this.persist();
    return ticket;
  }
  updateSupportTicketStatus(params) {
    const ticket = this.data.supportTickets.find((t) => t.id === params.ticketId);
    if (!ticket) throw new Error("Ticket support introuvable.");
    const oldStatus = ticket.status;
    ticket.status = params.status;
    if (params.priority) ticket.priority = params.priority;
    ticket.updatedAt = Date.now();
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "SUPPORT_TICKET_STATUS_CHANGED",
      category: "support",
      targetId: ticket.id,
      oldValue: { status: oldStatus },
      newValue: { status: ticket.status },
      ip: params.ip,
      detail: `Ticket ${ticket.id} : ${oldStatus} -> ${ticket.status}`
    });
    this.persist();
    return ticket;
  }
  addSupportInternalNote(params) {
    const ticket = this.data.supportTickets.find((t) => t.id === params.ticketId);
    if (!ticket) throw new Error("Ticket support introuvable.");
    const now = Date.now();
    ticket.internalNotes.unshift({
      id: `note_${now}_${import_crypto2.default.randomBytes(3).toString("hex")}`,
      adminEmail: params.adminEmail,
      note: params.note.trim().slice(0, 2e3),
      createdAt: now
    });
    ticket.updatedAt = now;
    this.persist();
    return ticket;
  }
  // --- Unified Users & Analytics ---
  listAllUsersSummary(externalFirestoreUsers) {
    if (externalFirestoreUsers?.length) {
      externalFirestoreUsers.forEach((u) => {
        if (!u.uid) return;
        this.upsertDirectoryUser({
          uid: u.uid,
          email: u.email,
          displayName: u.displayName,
          photoURL: u.photoURL,
          createdAt: u.createdAt ?? null,
          lastLoginAt: u.lastActiveAt ?? null
        });
      });
    }
    const now = Date.now();
    const uids = /* @__PURE__ */ new Set([
      ...Object.keys(this.data.userDirectory),
      ...Object.keys(this.data.subscriptions)
    ]);
    const summaries = [];
    uids.forEach((uid) => {
      const dir = this.getUserGovernance(uid);
      const sub = this.getUserSubscription(uid, {
        email: dir?.email || null,
        userCreatedAtMs: dir?.createdAt || null
      });
      const presence = this.computePresenceState(uid, now);
      const email = dir?.email || sub.email || null;
      const role = dir?.role || this.resolveUserRole(email, Boolean(dir?.emailVerified));
      summaries.push({
        uid,
        email,
        displayName: dir?.displayName || null,
        photoURL: dir?.photoURL || null,
        emailVerified: Boolean(dir?.emailVerified),
        role,
        createdAt: dir?.createdAt || sub.startDate || null,
        lastLoginAt: dir?.lastLoginAt || (presence.lastHeartbeatAt || null),
        accountStatus: dir?.accountStatus || "active",
        suspensionReason: dir?.suspensionReason || null,
        suspensionExpiresAt: dir?.suspensionExpiresAt || null,
        banReason: dir?.banReason || null,
        bannedAt: dir?.bannedAt || null,
        softDeletedAt: dir?.softDeletedAt || null,
        presence,
        subscription: sub,
        sanctionHistory: dir?.sanctionHistory || []
      });
    });
    return summaries.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
  getAdminOverviewStats() {
    const subs = this.listAllSubscriptionsForAdmin();
    const codes = this.listRedeemCodesForAdmin();
    const now = Date.now();
    return {
      totalRecordedSubscriptions: subs.length,
      freeUsers: subs.filter((s) => s.effectivePlan === "FREE").length,
      premiumUsers: subs.filter((s) => s.effectivePlan === "PREMIUM").length,
      familyUsers: subs.filter((s) => s.effectivePlan === "FAMILY").length,
      businessUsers: subs.filter((s) => s.effectivePlan === "BUSINESS").length,
      earlyTesterUsers: subs.filter(
        (s) => s.isEarlyTester && s.earlyTesterEndDate && s.earlyTesterEndDate > now
      ).length,
      lifetimeUsers: subs.filter((s) => s.isLifetime && s.status === "active").length,
      suspendedSubscriptions: subs.filter((s) => s.status === "suspended").length,
      expiredSubscriptions: subs.filter((s) => s.status === "expired").length,
      totalCodes: codes.length,
      usedCodes: codes.filter((c) => c.status === "used").length,
      availableCodes: codes.filter((c) => c.status === "available").length,
      revokedCodes: codes.filter((c) => c.status === "revoked").length,
      expiredCodes: codes.filter((c) => c.status === "expired").length,
      disabledCodes: codes.filter((c) => c.status === "disabled").length
    };
  }
  getOverviewAnalytics(externalFirestoreUsers) {
    const users = this.listAllUsersSummary(externalFirestoreUsers);
    const stats = this.getAdminOverviewStats();
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1e3;
    const startOfToday = /* @__PURE__ */ new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const weekAgoMs = now - 7 * dayMs;
    const newToday = users.filter((u) => u.createdAt && u.createdAt >= todayMs).length;
    const newThisWeek = users.filter((u) => u.createdAt && u.createdAt >= weekAgoMs).length;
    const activeUsers = users.filter((u) => u.accountStatus === "active").length;
    const bannedUsers = users.filter((u) => u.accountStatus === "banned").length;
    const suspendedUsers = users.filter((u) => u.accountStatus === "suspended").length;
    const deletedUsers = users.filter((u) => u.accountStatus === "soft_deleted").length;
    const onlineUsers = users.filter((u) => u.presence.state === "online").length;
    const idleUsers = users.filter((u) => u.presence.state === "idle").length;
    const offlineUsers = users.filter((u) => u.presence.state === "offline").length;
    const dailySeries = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayMs - i * dayMs);
      const dayStart = d.getTime();
      const dayEnd = dayStart + dayMs;
      const label = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
      const signups = users.filter(
        (u) => u.createdAt && u.createdAt >= dayStart && u.createdAt < dayEnd
      ).length;
      const activations = this.data.activations.filter(
        (a) => a.activatedAt >= dayStart && a.activatedAt < dayEnd
      ).length;
      const redeemActivations = this.data.activations.filter(
        (a) => a.source === "redeem" && a.activatedAt >= dayStart && a.activatedAt < dayEnd
      ).length;
      dailySeries.push({ date: label, signups, activations, redeemActivations });
    }
    const planDistribution = [
      { name: "Free", value: users.filter((u) => u.subscription.effectivePlan === "FREE").length, color: "#64748b" },
      { name: "Premium", value: users.filter((u) => u.subscription.effectivePlan === "PREMIUM").length, color: "#3b82f6" },
      { name: "Family", value: users.filter((u) => u.subscription.effectivePlan === "FAMILY").length, color: "#6366f1" },
      { name: "Business", value: users.filter((u) => u.subscription.effectivePlan === "BUSINESS").length, color: "#10b981" }
    ];
    const pendingAccessibility = this.data.accessibilityRequests.filter(
      (r) => r.status === "pending" || r.status === "more_info_required"
    ).length;
    const openSupportTickets = this.data.supportTickets.filter(
      (t) => t.status === "open" || t.status === "in_progress"
    ).length;
    const newBusinessQuotes = this.data.businessQuotes.filter((q) => q.status === "new").length;
    return {
      kpis: {
        totalUsers: users.length,
        activeUsers,
        newToday,
        newThisWeek,
        bannedUsers,
        suspendedUsers,
        deletedUsers,
        onlineUsers,
        idleUsers,
        offlineUsers,
        freeUsers: planDistribution[0].value,
        premiumUsers: planDistribution[1].value,
        familyUsers: planDistribution[2].value,
        businessUsers: planDistribution[3].value,
        activeSubscriptions: users.filter(
          (u) => u.subscription.effectivePlan !== "FREE" && u.subscription.status === "active"
        ).length,
        expiredSubscriptions: stats.expiredSubscriptions,
        suspendedSubscriptions: stats.suspendedSubscriptions,
        lifetimeSubscriptions: stats.lifetimeUsers,
        pioneerUsers: stats.earlyTesterUsers,
        totalCodes: stats.totalCodes,
        availableCodes: stats.availableCodes,
        usedCodes: stats.usedCodes,
        expiredCodes: stats.expiredCodes,
        revokedCodes: stats.revokedCodes,
        disabledCodes: stats.disabledCodes,
        pendingAccessibility,
        openSupportTickets,
        newBusinessQuotes
      },
      dailySeries,
      planDistribution,
      recentAuditLogs: this.data.auditLogs.slice(0, 15)
    };
  }
  // =========================================================================
  // Android APK Releases, Versioning, Backup/Retention & Download Analytics
  // =========================================================================
  stripAndroidReleasePaths(rel) {
    const fileAvailable = Boolean(rel.storagePath && import_fs2.default.existsSync(rel.storagePath));
    const hasBackup = Boolean(rel.backupPath && import_fs2.default.existsSync(rel.backupPath));
    const { storagePath: _sp, backupPath: _bp, ...publicShape } = rel;
    return {
      ...publicShape,
      fileAvailable,
      hasBackup
    };
  }
  ensureBackupCopy(rel) {
    this.ensureDirectories();
    if (!rel.storagePath || !import_fs2.default.existsSync(rel.storagePath)) return;
    const backupTarget = import_path2.default.join(APK_BACKUPS_DIR, `${rel.id}.bak.apk`);
    if (!import_fs2.default.existsSync(backupTarget)) {
      import_fs2.default.copyFileSync(rel.storagePath, backupTarget);
    }
    rel.backupPath = backupTarget;
    rel.hasBackup = true;
  }
  getAndroidAppSettings() {
    return { ...this.data.androidAppSettings };
  }
  updateAndroidAppSettings(params) {
    const prev = { ...this.data.androidAppSettings };
    const u = params.updates;
    if (typeof u.downloadsEnabled === "boolean") {
      this.data.androidAppSettings.downloadsEnabled = u.downloadsEnabled;
    }
    if (typeof u.appName === "string" && u.appName.trim()) {
      this.data.androidAppSettings.appName = u.appName.trim().slice(0, 80);
    }
    if (typeof u.packageName === "string" && u.packageName.trim()) {
      this.data.androidAppSettings.packageName = u.packageName.trim().slice(0, 120);
    }
    if (typeof u.description === "string") {
      this.data.androidAppSettings.description = u.description.trim().slice(0, 1500);
    }
    if (typeof u.minSupportedVersionCode === "number" && Number.isFinite(u.minSupportedVersionCode)) {
      this.data.androidAppSettings.minSupportedVersionCode = Math.max(
        1,
        Math.floor(u.minSupportedVersionCode)
      );
    }
    if (typeof u.retentionKeepCount === "number" && Number.isFinite(u.retentionKeepCount)) {
      this.data.androidAppSettings.retentionKeepCount = Math.max(
        1,
        Math.min(20, Math.floor(u.retentionKeepCount))
      );
    }
    if (typeof u.maxApkSizeBytes === "number" && Number.isFinite(u.maxApkSizeBytes)) {
      this.data.androidAppSettings.maxApkSizeBytes = Math.max(
        5 * 1024 * 1024,
        Math.min(500 * 1024 * 1024, Math.floor(u.maxApkSizeBytes))
      );
    }
    this.data.androidAppSettings.updatedAt = Date.now();
    this.data.androidAppSettings.updatedBy = params.adminEmail;
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "ANDROID_SETTINGS_UPDATED",
      category: "android_app",
      oldValue: {
        downloadsEnabled: prev.downloadsEnabled,
        minSupportedVersionCode: prev.minSupportedVersionCode,
        retentionKeepCount: prev.retentionKeepCount
      },
      newValue: {
        downloadsEnabled: this.data.androidAppSettings.downloadsEnabled,
        minSupportedVersionCode: this.data.androidAppSettings.minSupportedVersionCode,
        retentionKeepCount: this.data.androidAppSettings.retentionKeepCount
      },
      ip: params.ip,
      detail: `Param\xE8tres Android mis \xE0 jour (t\xE9l\xE9chargements ${this.data.androidAppSettings.downloadsEnabled ? "activ\xE9s" : "d\xE9sactiv\xE9s"}, versionCode min=${this.data.androidAppSettings.minSupportedVersionCode})`
    });
    this.persist();
    return this.getAndroidAppSettings();
  }
  listAndroidReleases() {
    return [...this.data.androidReleases].sort((a, b) => {
      if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1;
      if (b.versionCode !== a.versionCode) return b.versionCode - a.versionCode;
      return b.createdAt - a.createdAt;
    }).map((r) => this.stripAndroidReleasePaths(r));
  }
  getAndroidReleaseById(id) {
    const found = this.data.androidReleases.find((r) => r.id === id);
    return found ? this.stripAndroidReleasePaths(found) : null;
  }
  getCurrentPublishedAndroidRelease() {
    const published = this.data.androidReleases.filter((r) => r.status === "published");
    if (published.length === 0) return null;
    const explicitCurrent = published.find((r) => r.isCurrent);
    if (explicitCurrent) return this.stripAndroidReleasePaths(explicitCurrent);
    const highest = [...published].sort((a, b) => b.versionCode - a.versionCode)[0];
    return highest ? this.stripAndroidReleasePaths(highest) : null;
  }
  getLatestPublicAndroidInfo(installedVersionCode) {
    const settings = this.data.androidAppSettings;
    const latest = this.getCurrentPublishedAndroidRelease();
    if (!settings.downloadsEnabled || !latest || !latest.fileAvailable) {
      const disabledReason = !settings.downloadsEnabled ? "Le t\xE9l\xE9chargement de l\u2019application Android est temporairement d\xE9sactiv\xE9 par l\u2019administrateur." : "Aucune version Android publi\xE9e n\u2019est actuellement disponible au t\xE9l\xE9chargement.";
      return {
        downloadsEnabled: settings.downloadsEnabled,
        available: false,
        appName: latest?.appName || settings.appName,
        packageName: latest?.packageName || settings.packageName,
        description: settings.description,
        releaseId: null,
        versionName: null,
        versionCode: null,
        downloadUrl: null,
        fileName: null,
        disabledReason,
        fileSize: null,
        sha256: null,
        releaseDate: null,
        publishedAt: null,
        whatsNew: [],
        releaseDescription: null,
        minAndroidVersion: null,
        minAndroidApi: null,
        updateType: "optional",
        mandatory: false,
        updateAvailable: false,
        minSupportedVersionCode: settings.minSupportedVersionCode,
        mandatoryReason: null
      };
    }
    const hasInstalled = typeof installedVersionCode === "number" && Number.isFinite(installedVersionCode) && installedVersionCode > 0;
    const updateAvailable = hasInstalled ? latest.versionCode > installedVersionCode : true;
    const effectiveMinSupported = Math.max(
      settings.minSupportedVersionCode || 1,
      latest.minSupportedVersionCode || 1
    );
    let mandatory = false;
    let mandatoryReason = null;
    if (hasInstalled && installedVersionCode < effectiveMinSupported) {
      mandatory = true;
      mandatoryReason = `Votre version install\xE9e (code ${installedVersionCode}) n\u2019est plus compatible avec les exigences de s\xE9curit\xE9 VruGuard (minimum requis : code ${effectiveMinSupported}).`;
    } else if (latest.updateType === "mandatory" && updateAvailable) {
      mandatory = true;
      mandatoryReason = "Une mise \xE0 jour critique de s\xE9curit\xE9 et de compatibilit\xE9 VruGuard est requise pour continuer.";
    }
    return {
      downloadsEnabled: true,
      available: true,
      appName: latest.appName || settings.appName,
      packageName: latest.packageName || settings.packageName,
      description: settings.description,
      releaseId: latest.id,
      versionName: latest.versionName,
      versionCode: latest.versionCode,
      downloadUrl: `/api/android-app/download/${encodeURIComponent(latest.id)}`,
      fileName: latest.fileName,
      disabledReason: null,
      fileSize: latest.fileSize,
      sha256: latest.sha256,
      releaseDate: latest.releaseDate,
      publishedAt: latest.publishedAt,
      whatsNew: latest.whatsNew,
      releaseDescription: latest.description,
      minAndroidVersion: latest.minAndroidVersion,
      minAndroidApi: latest.minAndroidApi,
      updateType: mandatory ? "mandatory" : latest.updateType,
      mandatory,
      updateAvailable,
      minSupportedVersionCode: effectiveMinSupported,
      mandatoryReason
    };
  }
  createAndroidRelease(params) {
    this.ensureDirectories();
    const versionCode = Math.floor(Number(params.versionCode));
    if (!Number.isFinite(versionCode) || versionCode < 1) {
      throw new Error("Le code de version (versionCode) doit \xEAtre un entier positif (>= 1).");
    }
    const versionName = (params.versionName || "").trim();
    if (!versionName || !/^[0-9]+(\.[0-9]+){1,3}(-[a-zA-Z0-9._-]+)?$/.test(versionName)) {
      throw new Error("Format du num\xE9ro de version invalide (ex. 1.0.0 ou 1.2.0-beta.1).");
    }
    const duplicateCode = this.data.androidReleases.find((r) => r.versionCode === versionCode);
    if (duplicateCode) {
      throw new Error(
        `Le versionCode ${versionCode} existe d\xE9j\xE0 (${duplicateCode.versionName}). Utilisez un code de version strictement sup\xE9rieur pour ne jamais \xE9craser un paquet existant.`
      );
    }
    const now = Date.now();
    const id = `apk_${now}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
    const safeStorageName = `${id}.apk`;
    const destPath = import_path2.default.join(APK_RELEASES_DIR, safeStorageName);
    import_fs2.default.copyFileSync(params.tempFilePath, destPath);
    try {
      import_fs2.default.unlinkSync(params.tempFilePath);
    } catch {
    }
    const shouldBeCurrent = params.status === "published" && params.setAsCurrent;
    let backupPath = null;
    if (params.status === "published") {
      const bakTarget = import_path2.default.join(APK_BACKUPS_DIR, `${id}.bak.apk`);
      import_fs2.default.copyFileSync(destPath, bakTarget);
      backupPath = bakTarget;
    }
    if (shouldBeCurrent) {
      this.data.androidReleases.forEach((rel) => {
        if (rel.isCurrent) {
          rel.isCurrent = false;
          rel.isArchived = true;
          rel.updatedAt = now;
        }
      });
    }
    const record = {
      id,
      appName: (params.appName || this.data.androidAppSettings.appName || "VruGuard").trim().slice(0, 80),
      packageName: (params.packageName || this.data.androidAppSettings.packageName || "com.vruguard.sentinel").trim(),
      versionName,
      versionCode,
      fileName: import_path2.default.basename(params.originalFileName || `VruGuard-${versionName}.apk`),
      fileSize: params.fileSize,
      sha256: params.sha256,
      mimeType: "application/vnd.android.package-archive",
      description: (params.description || "").trim().slice(0, 3e3),
      whatsNew: params.whatsNew.map((line) => line.trim()).filter(Boolean).slice(0, 30),
      releaseDate: params.releaseDate || new Date(now).toISOString().slice(0, 10),
      publishedAt: params.status === "published" ? now : null,
      status: params.status,
      minAndroidVersion: (params.minAndroidVersion || "Android 8.0 (API 26)").trim(),
      minAndroidApi: Number(params.minAndroidApi) || 26,
      updateType: params.updateType === "mandatory" ? "mandatory" : "optional",
      minSupportedVersionCode: typeof params.minSupportedVersionCode === "number" && Number.isFinite(params.minSupportedVersionCode) && params.minSupportedVersionCode >= 1 ? Math.floor(params.minSupportedVersionCode) : null,
      isCurrent: shouldBeCurrent,
      isArchived: false,
      hasBackup: Boolean(backupPath),
      fileAvailable: true,
      downloadsInitiated: 0,
      downloadsCompleted: 0,
      lastDownloadedAt: null,
      uploadedByUid: params.adminUid,
      uploadedByEmail: params.adminEmail,
      createdAt: now,
      updatedAt: now,
      storagePath: destPath,
      backupPath
    };
    if (record.status === "published" && !this.data.androidReleases.some((r) => r.status === "published" && r.isCurrent)) {
      record.isCurrent = true;
    }
    this.data.androidReleases.unshift(record);
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: record.status === "published" ? "ANDROID_APK_PUBLISHED" : "ANDROID_APK_UPLOADED",
      category: "android_app",
      targetId: record.id,
      newValue: {
        versionName: record.versionName,
        versionCode: record.versionCode,
        status: record.status,
        isCurrent: record.isCurrent,
        sha256: record.sha256,
        fileSize: record.fileSize
      },
      ip: params.ip,
      detail: `APK v${record.versionName} (code ${record.versionCode}) enregistr\xE9 [${record.status}] \xB7 SHA-256 ${record.sha256.slice(0, 12)}\u2026`
    });
    this.persist();
    return this.stripAndroidReleasePaths(record);
  }
  updateAndroidReleaseMetadata(params) {
    const rel = this.data.androidReleases.find((r) => r.id === params.id);
    if (!rel) {
      throw new Error("Version Android introuvable.");
    }
    const prev = {
      versionName: rel.versionName,
      description: rel.description,
      updateType: rel.updateType,
      minAndroidVersion: rel.minAndroidVersion
    };
    const u = params.updates;
    if (typeof u.appName === "string" && u.appName.trim()) {
      rel.appName = u.appName.trim().slice(0, 80);
    }
    if (typeof u.versionName === "string" && u.versionName.trim()) {
      if (!/^[0-9]+(\.[0-9]+){1,3}(-[a-zA-Z0-9._-]+)?$/.test(u.versionName.trim())) {
        throw new Error("Format de versionName invalide.");
      }
      rel.versionName = u.versionName.trim();
    }
    if (typeof u.description === "string") {
      rel.description = u.description.trim().slice(0, 3e3);
    }
    if (Array.isArray(u.whatsNew)) {
      rel.whatsNew = u.whatsNew.map((s) => s.trim()).filter(Boolean).slice(0, 30);
    }
    if (typeof u.releaseDate === "string" && u.releaseDate.trim()) {
      rel.releaseDate = u.releaseDate.trim();
    }
    if (typeof u.minAndroidVersion === "string" && u.minAndroidVersion.trim()) {
      rel.minAndroidVersion = u.minAndroidVersion.trim();
    }
    if (typeof u.minAndroidApi === "number" && Number.isFinite(u.minAndroidApi)) {
      rel.minAndroidApi = Math.max(21, Math.min(36, Math.floor(u.minAndroidApi)));
    }
    if (u.updateType === "optional" || u.updateType === "mandatory") {
      rel.updateType = u.updateType;
    }
    if (u.minSupportedVersionCode !== void 0) {
      rel.minSupportedVersionCode = typeof u.minSupportedVersionCode === "number" && Number.isFinite(u.minSupportedVersionCode) && u.minSupportedVersionCode >= 1 ? Math.floor(u.minSupportedVersionCode) : null;
    }
    rel.updatedAt = Date.now();
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "ANDROID_APK_METADATA_UPDATED",
      category: "android_app",
      targetId: rel.id,
      oldValue: prev,
      newValue: {
        versionName: rel.versionName,
        description: rel.description,
        updateType: rel.updateType,
        minAndroidVersion: rel.minAndroidVersion
      },
      ip: params.ip,
      detail: `M\xE9tadonn\xE9es APK v${rel.versionName} (code ${rel.versionCode}) modifi\xE9es`
    });
    this.persist();
    return this.stripAndroidReleasePaths(rel);
  }
  async setAndroidReleaseStatus(params) {
    const rel = this.data.androidReleases.find((r) => r.id === params.id);
    if (!rel) {
      throw new Error("Version Android introuvable.");
    }
    const now = Date.now();
    const oldState = { status: rel.status, isCurrent: rel.isCurrent };
    if (params.action === "publish" || params.action === "restore") {
      if (params.action === "restore" && rel.versionCode < (this.data.androidAppSettings.minSupportedVersionCode || 1)) {
        throw new Error(
          `Impossible de restaurer la version ${rel.versionName} (code ${rel.versionCode}) : elle est inf\xE9rieure au seuil minimal de s\xE9curit\xE9 configur\xE9 (code ${this.data.androidAppSettings.minSupportedVersionCode}).`
        );
      }
      if ((!rel.storagePath || !import_fs2.default.existsSync(rel.storagePath)) && rel.backupPath && import_fs2.default.existsSync(rel.backupPath)) {
        const recoveredPath = import_path2.default.join(APK_RELEASES_DIR, `${rel.id}.apk`);
        import_fs2.default.copyFileSync(rel.backupPath, recoveredPath);
        rel.storagePath = recoveredPath;
      }
      if (!rel.storagePath || !import_fs2.default.existsSync(rel.storagePath)) {
        throw new Error("Le fichier binaire .apk est introuvable sur le stockage s\xE9curis\xE9.");
      }
      const currentSha = await computeFileSha256(rel.storagePath);
      if (currentSha !== rel.sha256) {
        throw new Error(
          "\xC9chec de v\xE9rification SHA-256 : le fichier APK stock\xE9 ne correspond plus \xE0 l\u2019empreinte enregistr\xE9e."
        );
      }
      this.ensureBackupCopy(rel);
      this.data.androidReleases.forEach((other) => {
        if (other.id !== rel.id && other.isCurrent) {
          other.isCurrent = false;
          other.isArchived = true;
          other.updatedAt = now;
        }
      });
      rel.status = "published";
      rel.isCurrent = true;
      rel.isArchived = false;
      if (!rel.publishedAt) {
        rel.publishedAt = now;
      }
      rel.updatedAt = now;
    } else if (params.action === "unpublish") {
      rel.status = "draft";
      rel.isCurrent = false;
      rel.updatedAt = now;
    } else if (params.action === "disable") {
      rel.status = "disabled";
      rel.isCurrent = false;
      rel.updatedAt = now;
    }
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: `ANDROID_APK_${params.action.toUpperCase()}`,
      category: "android_app",
      targetId: rel.id,
      oldValue: oldState,
      newValue: { status: rel.status, isCurrent: rel.isCurrent },
      ip: params.ip,
      detail: `Action "${params.action}" sur APK v${rel.versionName} (code ${rel.versionCode})`
    });
    this.persist();
    return this.stripAndroidReleasePaths(rel);
  }
  deleteAndroidRelease(params) {
    const idx = this.data.androidReleases.findIndex((r) => r.id === params.id);
    if (idx === -1) {
      throw new Error("Version Android introuvable.");
    }
    const rel = this.data.androidReleases[idx];
    if (rel.isCurrent) {
      throw new Error(
        "Protection anti-suppression : impossible de supprimer la version actuellement active. Publiez une autre version ou d\xE9publiez-la d\u2019abord."
      );
    }
    if (rel.status === "published") {
      throw new Error(
        "Protection anti-suppression : d\xE9publiez ou d\xE9sactivez cette version avant de la supprimer."
      );
    }
    const keepCount = Math.max(1, this.data.androidAppSettings.retentionKeepCount || 3);
    const sortedByRecency = [...this.data.androidReleases].sort(
      (a, b) => b.versionCode - a.versionCode
    );
    const rank = sortedByRecency.findIndex((r) => r.id === rel.id);
    if (rank !== -1 && rank < keepCount && !params.confirmRetentionOverride) {
      throw new Error(
        `R\xE8gle de conservation : cette version fait partie des ${keepCount} versions les plus r\xE9centes conserv\xE9es pour restauration. Confirmez explicitement la suppression forc\xE9e.`
      );
    }
    if (rel.storagePath && import_fs2.default.existsSync(rel.storagePath)) {
      try {
        import_fs2.default.unlinkSync(rel.storagePath);
      } catch {
      }
    }
    if (rel.backupPath && import_fs2.default.existsSync(rel.backupPath)) {
      try {
        import_fs2.default.unlinkSync(rel.backupPath);
      } catch {
      }
    }
    this.data.androidReleases.splice(idx, 1);
    this.recordAuditLog({
      adminUid: params.adminUid,
      adminEmail: params.adminEmail,
      adminRole: "SUPER_ADMIN",
      action: "ANDROID_APK_DELETED",
      category: "android_app",
      targetId: rel.id,
      oldValue: {
        versionName: rel.versionName,
        versionCode: rel.versionCode,
        sha256: rel.sha256
      },
      ip: params.ip,
      detail: `Suppression d\xE9finitive de l\u2019APK v${rel.versionName} (code ${rel.versionCode})`
    });
    this.persist();
  }
  async getAndroidReleaseBinaryForDownload(id, allowUnpublished = false) {
    const rel = this.data.androidReleases.find((r) => r.id === id);
    if (!rel) return null;
    if (!allowUnpublished) {
      if (!this.data.androidAppSettings.downloadsEnabled || rel.status !== "published") {
        return null;
      }
    }
    let targetPath = rel.storagePath;
    if (!targetPath || !import_fs2.default.existsSync(targetPath)) {
      if (rel.backupPath && import_fs2.default.existsSync(rel.backupPath)) {
        targetPath = rel.backupPath;
      } else {
        return null;
      }
    }
    const actualSha = await computeFileSha256(targetPath);
    if (actualSha !== rel.sha256) {
      if (targetPath !== rel.backupPath && rel.backupPath && import_fs2.default.existsSync(rel.backupPath) && await computeFileSha256(rel.backupPath) === rel.sha256) {
        import_fs2.default.copyFileSync(rel.backupPath, rel.storagePath);
        targetPath = rel.storagePath;
      } else {
        throw new Error("Int\xE9grit\xE9 SHA-256 de l\u2019APK compromise. T\xE9l\xE9chargement bloqu\xE9.");
      }
    }
    const stat = import_fs2.default.statSync(targetPath);
    return {
      release: this.stripAndroidReleasePaths(rel),
      filePath: targetPath,
      fileName: `VruGuard-v${rel.versionName}.apk`,
      fileSize: stat.size,
      sha256: rel.sha256
    };
  }
  recordAndroidDownloadInitiated(params) {
    const rel = this.data.androidReleases.find((r) => r.id === params.releaseId);
    if (!rel) return null;
    const now = Date.now();
    const evt = {
      id: `dl_${now}_${import_crypto2.default.randomBytes(4).toString("hex")}`,
      releaseId: rel.id,
      versionName: rel.versionName,
      versionCode: rel.versionCode,
      status: "initiated",
      source: params.source,
      bytesTotal: params.bytesTotal,
      bytesSent: 0,
      initiatedAt: now,
      completedAt: null,
      country: params.country ?? null
    };
    rel.downloadsInitiated = (rel.downloadsInitiated || 0) + 1;
    rel.lastDownloadedAt = now;
    this.data.androidDownloadEvents.unshift(evt);
    if (this.data.androidDownloadEvents.length > 5e3) {
      this.data.androidDownloadEvents.length = 5e3;
    }
    this.persist();
    return evt;
  }
  markAndroidDownloadFinished(eventId, bytesSent, outcome) {
    const evt = this.data.androidDownloadEvents.find((e) => e.id === eventId);
    if (!evt) return null;
    if (evt.status === "completed") return evt;
    const now = Date.now();
    evt.bytesSent = Math.max(evt.bytesSent || 0, bytesSent);
    evt.status = outcome;
    if (outcome === "completed") {
      evt.completedAt = now;
      const rel = this.data.androidReleases.find((r) => r.id === evt.releaseId);
      if (rel) {
        rel.downloadsCompleted = (rel.downloadsCompleted || 0) + 1;
        rel.lastDownloadedAt = now;
      }
    }
    this.persist();
    return evt;
  }
  getAndroidDownloadStats() {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1e3;
    const startOfToday = /* @__PURE__ */ new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todayMs = startOfToday.getTime();
    const weekAgoMs = now - 7 * dayMs;
    const events = this.data.androidDownloadEvents;
    const totalInitiated = events.length;
    const totalCompleted = events.filter((e) => e.status === "completed").length;
    const todayInitiated = events.filter((e) => e.initiatedAt >= todayMs).length;
    const todayCompleted = events.filter(
      (e) => e.status === "completed" && (e.completedAt || e.initiatedAt) >= todayMs
    ).length;
    const weekInitiated = events.filter((e) => e.initiatedAt >= weekAgoMs).length;
    const weekCompleted = events.filter(
      (e) => e.status === "completed" && (e.completedAt || e.initiatedAt) >= weekAgoMs
    ).length;
    const lastDownloadedAt = events.length > 0 ? Math.max(...events.map((e) => e.completedAt || e.initiatedAt)) : null;
    let storageUsedBytes = 0;
    this.data.androidReleases.forEach((rel) => {
      if (rel.storagePath && import_fs2.default.existsSync(rel.storagePath)) {
        storageUsedBytes += import_fs2.default.statSync(rel.storagePath).size;
      }
      if (rel.backupPath && import_fs2.default.existsSync(rel.backupPath)) {
        storageUsedBytes += import_fs2.default.statSync(rel.backupPath).size;
      }
    });
    const storageAvailableBytes = getAvailableStorageBytes(APK_RELEASES_DIR);
    const byVersion = [...this.data.androidReleases].sort((a, b) => b.versionCode - a.versionCode).map((rel) => ({
      releaseId: rel.id,
      versionName: rel.versionName,
      versionCode: rel.versionCode,
      status: rel.status,
      isCurrent: rel.isCurrent,
      initiated: rel.downloadsInitiated || 0,
      completed: rel.downloadsCompleted || 0,
      lastDownloadedAt: rel.lastDownloadedAt || null
    }));
    const dailySeries = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(todayMs - i * dayMs);
      const dayStart = d.getTime();
      const dayEnd = dayStart + dayMs;
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
      const initiated = events.filter(
        (e) => e.initiatedAt >= dayStart && e.initiatedAt < dayEnd
      ).length;
      const completed = events.filter(
        (e) => e.status === "completed" && (e.completedAt || e.initiatedAt) >= dayStart && (e.completedAt || e.initiatedAt) < dayEnd
      ).length;
      dailySeries.push({ date: iso, label, initiated, completed });
    }
    return {
      totalInitiated,
      totalCompleted,
      todayInitiated,
      todayCompleted,
      weekInitiated,
      weekCompleted,
      lastDownloadedAt,
      storageUsedBytes,
      storageAvailableBytes,
      byVersion,
      dailySeries
    };
  }
  // =========================================================================
  // First Login Consent & RGPD Compliance (Server-Authoritative & Account-Scoped)
  // =========================================================================
  isConsentRecordValidForCurrentVersions(record) {
    if (!record) return false;
    return record.status === "accepted" && record.consentVersion === CURRENT_CONSENT_VERSION && record.termsVersion === CURRENT_TERMS_VERSION && record.privacyVersion === CURRENT_PRIVACY_VERSION && Boolean(record.acceptedAt);
  }
  getUserConsentStatus(uid) {
    const rec = this.data.userConsents[uid] || null;
    const accessAllowed = this.isConsentRecordValidForCurrentVersions(rec);
    if (!rec) {
      return {
        consentStatus: "pending",
        consentVersion: null,
        termsVersion: null,
        privacyVersion: null,
        currentConsentVersion: CURRENT_CONSENT_VERSION,
        currentTermsVersion: CURRENT_TERMS_VERSION,
        currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
        acceptedAt: null,
        refusedAt: null,
        withdrawnAt: null,
        platform: null,
        accessAllowed: false,
        requiresConsent: true,
        optionalConsents: {
          notifications: false,
          locationEnhancements: false
        },
        historyCount: 0,
        updatedAt: null
      };
    }
    return {
      consentStatus: rec.status,
      consentVersion: rec.consentVersion,
      termsVersion: rec.termsVersion,
      privacyVersion: rec.privacyVersion,
      currentConsentVersion: CURRENT_CONSENT_VERSION,
      currentTermsVersion: CURRENT_TERMS_VERSION,
      currentPrivacyVersion: CURRENT_PRIVACY_VERSION,
      acceptedAt: rec.acceptedAt,
      refusedAt: rec.refusedAt,
      withdrawnAt: rec.withdrawnAt,
      platform: rec.platform,
      accessAllowed,
      requiresConsent: !accessAllowed,
      optionalConsents: {
        notifications: Boolean(rec.optionalConsents?.notifications),
        locationEnhancements: Boolean(rec.optionalConsents?.locationEnhancements)
      },
      historyCount: Array.isArray(rec.history) ? rec.history.length : 0,
      updatedAt: rec.updatedAt
    };
  }
  acceptUserConsent(params) {
    if (!params.uid) {
      throw new Error("Identifiant utilisateur requis.");
    }
    if (params.acceptedRequired !== true) {
      throw new Error(
        "Vous devez accepter explicitement les Conditions G\xE9n\xE9rales d\u2019Utilisation et prendre connaissance de la Politique de Confidentialit\xE9."
      );
    }
    if (params.platform !== "web" && params.platform !== "android") {
      throw new Error("Plateforme de consentement non reconnue (web ou android attendu).");
    }
    const reqConsentVer = (params.consentVersion || CURRENT_CONSENT_VERSION).trim();
    const reqTermsVer = (params.termsVersion || CURRENT_TERMS_VERSION).trim();
    const reqPrivacyVer = (params.privacyVersion || CURRENT_PRIVACY_VERSION).trim();
    if (reqConsentVer !== CURRENT_CONSENT_VERSION || reqTermsVer !== CURRENT_TERMS_VERSION || reqPrivacyVer !== CURRENT_PRIVACY_VERSION) {
      throw new Error(
        "La version des documents l\xE9gaux a chang\xE9. Veuillez recharger les informations actuelles avant de valider."
      );
    }
    if (this.consentLocks.has(params.uid)) {
      throw new Error("Traitement de consentement d\xE9j\xE0 en cours pour ce compte.");
    }
    this.consentLocks.add(params.uid);
    try {
      const now = Date.now();
      const existing = this.data.userConsents[params.uid] || null;
      if (this.isConsentRecordValidForCurrentVersions(existing)) {
        return {
          record: existing,
          alreadyAccepted: true,
          statusResponse: this.getUserConsentStatus(params.uid)
        };
      }
      const normalizedOptional = {
        notifications: Boolean(params.optionalConsents?.notifications),
        locationEnhancements: Boolean(params.optionalConsents?.locationEnhancements)
      };
      const historyEntry = {
        id: `cns_${now}_${import_crypto2.default.randomBytes(4).toString("hex")}`,
        action: "accepted",
        consentVersion: CURRENT_CONSENT_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        platform: params.platform,
        timestamp: now,
        ip: params.ip ?? null,
        optionalConsents: { ...normalizedOptional },
        detail: `Consentement initial accept\xE9 sur ${params.platform.toUpperCase()} (CGU ${CURRENT_TERMS_VERSION}, Confidentialit\xE9 ${CURRENT_PRIVACY_VERSION})`
      };
      const nextHistory = [historyEntry, ...existing?.history || []].slice(0, 200);
      const record = {
        userId: params.uid,
        email: params.email || existing?.email || null,
        status: "accepted",
        consentVersion: CURRENT_CONSENT_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        acceptedAt: now,
        refusedAt: null,
        withdrawnAt: null,
        platform: params.platform,
        optionalConsents: normalizedOptional,
        history: nextHistory,
        updatedAt: now
      };
      this.data.userConsents[params.uid] = record;
      this.recordAuditLog({
        adminUid: params.uid,
        adminEmail: params.email || params.uid,
        adminRole: "USER",
        action: "FIRST_CONSENT_ACCEPTED",
        category: "consent",
        targetUid: params.uid,
        targetEmail: params.email || null,
        oldValue: existing ? { status: existing.status, consentVersion: existing.consentVersion } : { status: "pending" },
        newValue: {
          status: "accepted",
          platform: params.platform,
          consentVersion: CURRENT_CONSENT_VERSION,
          termsVersion: CURRENT_TERMS_VERSION,
          privacyVersion: CURRENT_PRIVACY_VERSION,
          optionalConsents: normalizedOptional
        },
        ip: params.ip ?? null,
        detail: `Consentement obligatoire accept\xE9 par ${params.email || params.uid} depuis ${params.platform.toUpperCase()}`
      });
      this.persist();
      return {
        record,
        alreadyAccepted: false,
        statusResponse: this.getUserConsentStatus(params.uid)
      };
    } finally {
      this.consentLocks.delete(params.uid);
    }
  }
  refuseUserConsent(params) {
    if (params.platform !== "web" && params.platform !== "android") {
      throw new Error("Plateforme invalide (web ou android attendu).");
    }
    if (this.consentLocks.has(params.uid)) {
      throw new Error("Traitement d\xE9j\xE0 en cours pour ce compte.");
    }
    this.consentLocks.add(params.uid);
    try {
      const now = Date.now();
      const existing = this.data.userConsents[params.uid] || null;
      if (this.isConsentRecordValidForCurrentVersions(existing)) {
        throw new Error(
          "Votre consentement initial est d\xE9j\xE0 enregistr\xE9. Utilisez la r\xE9tractation RGPD dans votre profil si vous souhaitez le retirer."
        );
      }
      const emptyOptional = {
        notifications: false,
        locationEnhancements: false
      };
      const entry = {
        id: `cns_${now}_${import_crypto2.default.randomBytes(4).toString("hex")}`,
        action: "refused",
        consentVersion: CURRENT_CONSENT_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        platform: params.platform,
        timestamp: now,
        ip: params.ip ?? null,
        optionalConsents: { ...emptyOptional },
        detail: `Consentement initial refus\xE9 sur ${params.platform.toUpperCase()} \u2014 acc\xE8s bloqu\xE9`
      };
      const record = {
        userId: params.uid,
        email: params.email || existing?.email || null,
        status: "refused",
        consentVersion: CURRENT_CONSENT_VERSION,
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        acceptedAt: existing?.acceptedAt ?? null,
        refusedAt: now,
        withdrawnAt: existing?.withdrawnAt ?? null,
        platform: params.platform,
        optionalConsents: emptyOptional,
        history: [entry, ...existing?.history || []].slice(0, 200),
        updatedAt: now
      };
      this.data.userConsents[params.uid] = record;
      this.recordAuditLog({
        adminUid: params.uid,
        adminEmail: params.email || params.uid,
        adminRole: "USER",
        action: "FIRST_CONSENT_REFUSED",
        category: "consent",
        targetUid: params.uid,
        targetEmail: params.email || null,
        oldValue: existing ? { status: existing.status } : { status: "pending" },
        newValue: { status: "refused", platform: params.platform },
        ip: params.ip ?? null,
        detail: `Consentement obligatoire refus\xE9 par ${params.email || params.uid} (${params.platform.toUpperCase()})`
      });
      this.persist();
      return this.getUserConsentStatus(params.uid);
    } finally {
      this.consentLocks.delete(params.uid);
    }
  }
  updateOptionalConsents(params) {
    const existing = this.data.userConsents[params.uid];
    if (!this.isConsentRecordValidForCurrentVersions(existing)) {
      throw new Error(
        "Le consentement initial obligatoire doit \xEAtre accept\xE9 avant de modifier vos pr\xE9f\xE9rences facultatives."
      );
    }
    const now = Date.now();
    const prevOptional = { ...existing.optionalConsents };
    const nextOptional = {
      notifications: typeof params.optionalConsents.notifications === "boolean" ? params.optionalConsents.notifications : prevOptional.notifications,
      locationEnhancements: typeof params.optionalConsents.locationEnhancements === "boolean" ? params.optionalConsents.locationEnhancements : prevOptional.locationEnhancements
    };
    const entry = {
      id: `cns_${now}_${import_crypto2.default.randomBytes(4).toString("hex")}`,
      action: "preferences_updated",
      consentVersion: existing.consentVersion,
      termsVersion: existing.termsVersion,
      privacyVersion: existing.privacyVersion,
      platform: params.platform,
      timestamp: now,
      ip: params.ip ?? null,
      optionalConsents: { ...nextOptional },
      detail: `Pr\xE9f\xE9rences facultatives modifi\xE9es (${params.platform.toUpperCase()}) : notifications=${nextOptional.notifications ? "oui" : "non"}, g\xE9olocalisation_avanc\xE9e=${nextOptional.locationEnhancements ? "oui" : "non"}`
    };
    existing.optionalConsents = nextOptional;
    existing.updatedAt = now;
    existing.history = [entry, ...existing.history || []].slice(0, 200);
    this.recordAuditLog({
      adminUid: params.uid,
      adminEmail: params.email || existing.email || params.uid,
      adminRole: "USER",
      action: "CONSENT_PREFERENCES_UPDATED",
      category: "consent",
      targetUid: params.uid,
      targetEmail: params.email || existing.email || null,
      oldValue: prevOptional,
      newValue: nextOptional,
      ip: params.ip ?? null,
      detail: entry.detail
    });
    this.persist();
    return this.getUserConsentStatus(params.uid);
  }
  withdrawUserConsent(params) {
    const now = Date.now();
    const existing = this.data.userConsents[params.uid] || null;
    const emptyOptional = {
      notifications: false,
      locationEnhancements: false
    };
    const entry = {
      id: `cns_${now}_${import_crypto2.default.randomBytes(4).toString("hex")}`,
      action: "withdrawn",
      consentVersion: existing?.consentVersion || CURRENT_CONSENT_VERSION,
      termsVersion: existing?.termsVersion || CURRENT_TERMS_VERSION,
      privacyVersion: existing?.privacyVersion || CURRENT_PRIVACY_VERSION,
      platform: params.platform,
      timestamp: now,
      ip: params.ip ?? null,
      optionalConsents: { ...emptyOptional },
      detail: `Retrait du consentement demand\xE9 par l\u2019utilisateur sur ${params.platform.toUpperCase()} (RGPD)`
    };
    const record = {
      userId: params.uid,
      email: params.email || existing?.email || null,
      status: "withdrawn",
      consentVersion: existing?.consentVersion || CURRENT_CONSENT_VERSION,
      termsVersion: existing?.termsVersion || CURRENT_TERMS_VERSION,
      privacyVersion: existing?.privacyVersion || CURRENT_PRIVACY_VERSION,
      // Preserve historical proof of when consent was originally accepted
      acceptedAt: existing?.acceptedAt ?? null,
      refusedAt: existing?.refusedAt ?? null,
      withdrawnAt: now,
      platform: params.platform,
      optionalConsents: emptyOptional,
      history: [entry, ...existing?.history || []].slice(0, 200),
      updatedAt: now
    };
    this.data.userConsents[params.uid] = record;
    this.recordAuditLog({
      adminUid: params.uid,
      adminEmail: params.email || existing?.email || params.uid,
      adminRole: "USER",
      action: "USER_CONSENT_WITHDRAWN",
      category: "consent",
      targetUid: params.uid,
      targetEmail: params.email || existing?.email || null,
      oldValue: existing ? { status: existing.status } : { status: "pending" },
      newValue: { status: "withdrawn", platform: params.platform },
      ip: params.ip ?? null,
      detail: `Consentement retir\xE9 (RGPD) par ${params.email || params.uid}`
    });
    this.persist();
    return this.getUserConsentStatus(params.uid);
  }
  getAdminConsentsOverview(params) {
    const users = this.listAllUsersSummary(params?.externalFirestoreUsers);
    const rows = users.map((u) => {
      const rec = this.data.userConsents[u.uid] || null;
      const accessAllowed = this.isConsentRecordValidForCurrentVersions(rec);
      return {
        uid: u.uid,
        email: u.email,
        displayName: u.displayName,
        status: rec ? rec.status : "pending",
        consentVersion: rec?.consentVersion ?? null,
        termsVersion: rec?.termsVersion ?? null,
        privacyVersion: rec?.privacyVersion ?? null,
        acceptedAt: rec?.acceptedAt ?? null,
        refusedAt: rec?.refusedAt ?? null,
        withdrawnAt: rec?.withdrawnAt ?? null,
        platform: rec?.platform ?? null,
        optionalConsents: rec?.optionalConsents || {
          notifications: false,
          locationEnhancements: false
        },
        accessAllowed,
        historyCount: rec?.history?.length || 0,
        updatedAt: rec?.updatedAt ?? null,
        accountCreatedAt: u.createdAt ?? null
      };
    });
    const totalUsers = rows.length;
    const acceptedCount = rows.filter((r) => r.status === "accepted" && r.accessAllowed).length;
    const refusedCount = rows.filter((r) => r.status === "refused").length;
    const withdrawnCount = rows.filter((r) => r.status === "withdrawn").length;
    const pendingCount = rows.filter(
      (r) => r.status === "pending" || r.status === "accepted" && !r.accessAllowed
    ).length;
    const acceptanceRatePct = totalUsers > 0 ? Math.round(acceptedCount / totalUsers * 1e3) / 10 : 0;
    const acceptedTimestamps = rows.map((r) => r.acceptedAt).filter((ts) => typeof ts === "number" && ts > 0);
    const lastAcceptedAt = acceptedTimestamps.length > 0 ? Math.max(...acceptedTimestamps) : null;
    const q = (params?.search || "").trim().toLowerCase();
    const statusFilter = params?.statusFilter || "ALL";
    const platformFilter = params?.platformFilter || "ALL";
    const filteredUsers = rows.filter((row) => {
      if (statusFilter !== "ALL" && row.status !== statusFilter) return false;
      if (platformFilter !== "ALL" && row.platform !== platformFilter) return false;
      if (!q) return true;
      return row.uid.toLowerCase().includes(q) || (row.email || "").toLowerCase().includes(q) || (row.displayName || "").toLowerCase().includes(q);
    }).sort((a, b) => (b.updatedAt || b.accountCreatedAt || 0) - (a.updatedAt || a.accountCreatedAt || 0));
    return {
      stats: {
        totalUsers,
        acceptedCount,
        refusedCount,
        pendingCount,
        withdrawnCount,
        acceptanceRatePct,
        lastAcceptedAt,
        currentConsentVersion: CURRENT_CONSENT_VERSION,
        currentTermsVersion: CURRENT_TERMS_VERSION,
        currentPrivacyVersion: CURRENT_PRIVACY_VERSION
      },
      users: filteredUsers
    };
  }
  getAdminUserConsentDetail(uid) {
    const dir = this.getUserGovernance(uid);
    const sub = this.data.subscriptions[uid];
    const record = this.data.userConsents[uid] || null;
    return {
      status: this.getUserConsentStatus(uid),
      record,
      email: record?.email || dir?.email || sub?.email || null,
      displayName: dir?.displayName || null
    };
  }
};
var subscriptionStore = new SubscriptionStore();

// server/heatmapStore.ts
var import_fs3 = __toESM(require("fs"), 1);
var import_path3 = __toESM(require("path"), 1);
var import_ngeohash = __toESM(require("ngeohash"), 1);
var DATA_DIR2 = import_path3.default.join(process.cwd(), ".data");
var STORE_PATH2 = import_path3.default.join(DATA_DIR2, "heatmap-store.json");
var ALL_CATEGORIES = [
  "INCIDENT",
  "TRAFFIC",
  "WEATHER",
  "INFRASTRUCTURE",
  "EXTERNAL_ALERT"
];
var ALL_SEVERITIES = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
var ALL_SOURCES = [
  "VRUGUARD_USER",
  "TRAFFIC_API",
  "OPEN_METEO",
  "OPENSTREETMAP",
  "OFFICIAL_ALERT"
];
var MAX_RETENTION_MS = 40 * 24 * 60 * 60 * 1e3;
function buildDefaultHeatmapPreferences(uid) {
  return {
    uid,
    globalMode: true,
    categories: [...ALL_CATEGORIES],
    period: "24h",
    customStartAt: null,
    customEndAt: null,
    severities: [...ALL_SEVERITIES],
    sources: [...ALL_SOURCES],
    zoneFilter: {
      mode: "viewport",
      radiusMeters: 3e3
    },
    compareOffset: "none",
    updatedAt: Date.now()
  };
}
var HeatmapStore = class {
  constructor() {
    if (!import_fs3.default.existsSync(DATA_DIR2)) {
      import_fs3.default.mkdirSync(DATA_DIR2, { recursive: true });
    }
    this.data = this.load();
  }
  load() {
    try {
      if (import_fs3.default.existsSync(STORE_PATH2)) {
        const raw = import_fs3.default.readFileSync(STORE_PATH2, "utf8");
        const parsed = JSON.parse(raw);
        return {
          events: parsed.events || {},
          preferences: parsed.preferences || {},
          snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
          updatedAt: parsed.updatedAt || Date.now()
        };
      }
    } catch (err) {
      console.warn("HeatmapStore load fallback:", err.message);
    }
    return {
      events: {},
      preferences: {},
      snapshots: [],
      updatedAt: Date.now()
    };
  }
  persist() {
    try {
      const cutoff = Date.now() - MAX_RETENTION_MS;
      const prunedEvents = {};
      const entries = Object.entries(this.data.events);
      entries.filter(([, ev]) => (ev.lastUpdatedAt || ev.collectedAt) >= cutoff).sort((a, b) => b[1].lastUpdatedAt - a[1].lastUpdatedAt).slice(0, 12e3).forEach(([k, ev]) => {
        if (ev.expiresAt !== null && ev.expiresAt <= Date.now() && ev.status === "active") {
          ev.status = "expired";
        }
        prunedEvents[k] = ev;
      });
      this.data.events = prunedEvents;
      this.data.snapshots = this.data.snapshots.filter((s) => s.timestamp >= cutoff).slice(-2e3);
      this.data.updatedAt = Date.now();
      const tmpPath = `${STORE_PATH2}.tmp.${process.pid}`;
      import_fs3.default.writeFileSync(tmpPath, JSON.stringify(this.data), "utf8");
      import_fs3.default.renameSync(tmpPath, STORE_PATH2);
    } catch (err) {
      console.warn("HeatmapStore persist warning:", err.message);
    }
  }
  ingestEvents(incoming) {
    if (!incoming.length) return [];
    const now = Date.now();
    let changed = false;
    const merged = [];
    for (const raw of incoming) {
      const geohash = raw.geohash || import_ngeohash.default.encode(raw.lat, raw.lng, 7);
      const key = raw.dedupKey || `${geohash}:${raw.category}:${raw.subType}`;
      const existing = this.data.events[key];
      if (!existing) {
        const record = {
          ...raw,
          geohash,
          dedupKey: key,
          confirmations: Math.max(1, raw.confirmations || 1),
          status: raw.expiresAt !== null && raw.expiresAt <= now ? "expired" : raw.status || "active"
        };
        this.data.events[key] = record;
        merged.push(record);
        changed = true;
      } else {
        const isDistinctUpdate = raw.id !== existing.id || raw.lastUpdatedAt > existing.lastUpdatedAt + 6e4;
        const nextConfirmations = isDistinctUpdate ? Math.min(50, existing.confirmations + Math.max(1, raw.confirmations || 1)) : Math.max(existing.confirmations, raw.confirmations || 1);
        const nextReliability = isDistinctUpdate ? Number(
          Math.min(
            0.98,
            1 - (1 - existing.reliability) * (1 - raw.reliability * 0.45)
          ).toFixed(3)
        ) : Math.max(existing.reliability, raw.reliability);
        const nextSeverity = Math.max(existing.severityScore, raw.severityScore);
        const nextTier = severityTierFromScore(nextSeverity);
        const nextExpiresAt = raw.expiresAt === null || existing.expiresAt === null ? raw.expiresAt ?? existing.expiresAt : Math.max(existing.expiresAt, raw.expiresAt);
        const nextRecord = {
          ...existing,
          title: raw.severityScore >= existing.severityScore ? raw.title : existing.title,
          description: raw.description && raw.description.length > existing.description.length ? raw.description : existing.description,
          severityScore: nextSeverity,
          severityTier: nextTier,
          reliability: nextReliability,
          confirmations: nextConfirmations,
          natureWeight: Math.max(existing.natureWeight, raw.natureWeight),
          collectedAt: Math.min(existing.collectedAt, raw.collectedAt),
          lastUpdatedAt: Math.max(existing.lastUpdatedAt, raw.lastUpdatedAt),
          expiresAt: nextExpiresAt,
          status: nextExpiresAt !== null && nextExpiresAt <= now ? "expired" : raw.status || "active",
          metadata: {
            ...existing.metadata || {},
            ...raw.metadata || {}
          }
        };
        this.data.events[key] = nextRecord;
        merged.push(nextRecord);
        changed = true;
      }
    }
    if (changed) {
      this.persist();
    }
    return merged;
  }
  queryEvents(params) {
    const now = Date.now();
    const catSet = params.categories?.length ? new Set(params.categories) : null;
    const sevSet = params.severities?.length ? new Set(params.severities) : null;
    const srcSet = params.sources?.length ? new Set(params.sources) : null;
    const results = [];
    for (const ev of Object.values(this.data.events)) {
      if (ev.lat < params.minLat || ev.lat > params.maxLat || ev.lng < params.minLng || ev.lng > params.maxLng) {
        continue;
      }
      if (catSet && !catSet.has(ev.category)) continue;
      if (sevSet && !sevSet.has(ev.severityTier)) continue;
      if (srcSet && !srcSet.has(ev.source)) continue;
      const isCurrentlyExpired = ev.status === "expired" || ev.status === "resolved" || ev.expiresAt !== null && ev.expiresAt <= now;
      if (!params.includeExpired) {
        if (isCurrentlyExpired) continue;
        if (ev.category !== "INFRASTRUCTURE" && ev.lastUpdatedAt < params.startAt) {
          continue;
        }
      } else {
        const evStart = ev.collectedAt;
        const evEnd = ev.expiresAt ?? ev.lastUpdatedAt + 24 * 60 * 60 * 1e3;
        const overlaps = ev.category === "INFRASTRUCTURE" ? evStart <= params.endAt : evStart <= params.endAt && Math.max(evEnd, ev.lastUpdatedAt) >= params.startAt;
        if (!overlaps) continue;
      }
      results.push(ev);
    }
    return results;
  }
  getPreferences(uid) {
    const existing = this.data.preferences[uid];
    if (!existing) {
      return buildDefaultHeatmapPreferences(uid);
    }
    return existing;
  }
  savePreferences(uid, patch) {
    const current = this.getPreferences(uid);
    const nextCategories = Array.isArray(patch.categories) ? patch.categories.filter((c) => ALL_CATEGORIES.includes(c)) : current.categories;
    const nextSeverities = Array.isArray(patch.severities) ? patch.severities.filter((s) => ALL_SEVERITIES.includes(s)) : current.severities;
    const nextSources = Array.isArray(patch.sources) ? patch.sources.filter((s) => ALL_SOURCES.includes(s)) : current.sources;
    const updated = {
      ...current,
      ...patch,
      uid,
      categories: nextCategories.length ? nextCategories : [...ALL_CATEGORIES],
      severities: nextSeverities.length ? nextSeverities : [...ALL_SEVERITIES],
      sources: nextSources.length ? nextSources : [...ALL_SOURCES],
      zoneFilter: patch.zoneFilter ? {
        mode: patch.zoneFilter.mode || "viewport",
        label: patch.zoneFilter.label,
        center: patch.zoneFilter.center,
        radiusMeters: patch.zoneFilter.radiusMeters ?? current.zoneFilter.radiusMeters ?? 3e3
      } : current.zoneFilter,
      updatedAt: Date.now()
    };
    this.data.preferences[uid] = updated;
    this.persist();
    return updated;
  }
  recordSnapshot(geohash6, cellCount, avgRiskScore) {
    const now = Date.now();
    const recent = this.data.snapshots.find(
      (s) => s.geohash6 === geohash6 && now - s.timestamp < 30 * 60 * 1e3
    );
    if (recent) return;
    this.data.snapshots.push({
      id: `snap_${now}_${geohash6}`,
      geohash6,
      timestamp: now,
      cellCount,
      avgRiskScore: Math.round(avgRiskScore)
    });
    this.persist();
  }
};
function severityTierFromScore(score) {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}
var heatmapStore = new HeatmapStore();

// server/heatmapEngine.ts
var import_ngeohash2 = __toESM(require("ngeohash"), 1);
var weatherCache = /* @__PURE__ */ new Map();
var osmCache = /* @__PURE__ */ new Map();
var osmRoadBaselineCache = /* @__PURE__ */ new Map();
var trafficCache = /* @__PURE__ */ new Map();
var globalAlertsCache = /* @__PURE__ */ new Map();
var regionalFeedCache = /* @__PURE__ */ new Map();
var ALL_CATEGORIES2 = [
  "INCIDENT",
  "TRAFFIC",
  "WEATHER",
  "INFRASTRUCTURE",
  "EXTERNAL_ALERT"
];
var ALL_SEVERITIES2 = ["LOW", "MODERATE", "HIGH", "CRITICAL"];
var ALL_SOURCES2 = [
  "VRUGUARD_USER",
  "TRAFFIC_API",
  "OPEN_METEO",
  "OPENSTREETMAP",
  "OFFICIAL_ALERT"
];
var OVERPASS_MIRRORS = [
  { name: "Overpass DE", url: "https://overpass-api.de/api/interpreter" },
  { name: "Overpass Kumi Mirror", url: "https://overpass.kumi.systems/api/interpreter" },
  { name: "Overpass Private.Coffee Mirror", url: "https://overpass.private.coffee/api/interpreter" }
];
function haversineMeters(a, b) {
  const R = 6371e3;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function riskLevelFromScore(score) {
  if (score >= 75) return "CRITICAL";
  if (score >= 50) return "HIGH";
  if (score >= 25) return "MODERATE";
  return "LOW";
}
function resolveTimeWindow(period, customStartAt, customEndAt, nowMs = Date.now()) {
  const HOUR = 60 * 60 * 1e3;
  const DAY = 24 * HOUR;
  switch (period) {
    case "realtime":
      return { startAt: nowMs - 6 * HOUR, endAt: nowMs, isHistorical: false };
    case "24h":
      return { startAt: nowMs - DAY, endAt: nowMs, isHistorical: true };
    case "7d":
      return { startAt: nowMs - 7 * DAY, endAt: nowMs, isHistorical: true };
    case "30d":
      return { startAt: nowMs - 30 * DAY, endAt: nowMs, isHistorical: true };
    case "custom": {
      const start = typeof customStartAt === "number" && Number.isFinite(customStartAt) ? customStartAt : nowMs - 7 * DAY;
      const end = typeof customEndAt === "number" && Number.isFinite(customEndAt) ? Math.max(start + HOUR, customEndAt) : nowMs;
      return { startAt: start, endAt: end, isHistorical: true };
    }
    default:
      return { startAt: nowMs - DAY, endAt: nowMs, isHistorical: true };
  }
}
function resolveComparisonWindow(offset, currentStart, currentEnd, customStartAt, customEndAt) {
  if (!offset || offset === "none") return null;
  const span = Math.max(60 * 60 * 1e3, currentEnd - currentStart);
  const DAY = 24 * 60 * 60 * 1e3;
  if (offset === "custom" && customStartAt && customEndAt) {
    return {
      startAt: customStartAt,
      endAt: Math.max(customStartAt + 60 * 60 * 1e3, customEndAt),
      label: "P\xE9riode personnalis\xE9e"
    };
  }
  const shiftMs = offset === "24h" ? DAY : offset === "7d" ? 7 * DAY : 30 * DAY;
  const label = offset === "24h" ? "vs -24 heures" : offset === "7d" ? "vs -7 jours" : "vs -30 jours";
  return {
    startAt: currentStart - shiftMs,
    endAt: Math.min(currentStart, currentStart - shiftMs + span),
    label
  };
}
function getGeohashPrecisionForZoom(zoom) {
  if (zoom >= 15) return 7;
  if (zoom >= 12) return 6;
  if (zoom >= 9) return 5;
  if (zoom >= 6) return 4;
  return 3;
}
function deduplicateHeatmapEvents(events) {
  const map = /* @__PURE__ */ new Map();
  for (const ev of events) {
    const key = ev.dedupKey || `${import_ngeohash2.default.encode(ev.lat, ev.lng, 7)}:${ev.category}:${ev.subType}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, { ...ev, dedupKey: key });
    } else {
      const nextConf = Math.min(50, existing.confirmations + ev.confirmations);
      const nextRel = Number(
        Math.min(
          0.98,
          1 - (1 - existing.reliability) * (1 - ev.reliability * 0.45)
        ).toFixed(3)
      );
      const nextSev = Math.max(existing.severityScore, ev.severityScore);
      map.set(key, {
        ...existing,
        severityScore: nextSev,
        severityTier: severityTierFromScore(nextSev),
        reliability: nextRel,
        confirmations: nextConf,
        natureWeight: Math.max(existing.natureWeight, ev.natureWeight),
        collectedAt: Math.min(existing.collectedAt, ev.collectedAt),
        lastUpdatedAt: Math.max(existing.lastUpdatedAt, ev.lastUpdatedAt),
        expiresAt: existing.expiresAt === null || ev.expiresAt === null ? existing.expiresAt ?? ev.expiresAt : Math.max(existing.expiresAt, ev.expiresAt)
      });
    }
  }
  return Array.from(map.values());
}
function getRecencyDecay(ev, refTimeMs, isHistorical) {
  if (ev.category === "INFRASTRUCTURE") return 0.96;
  const ageHours = Math.max(0, (refTimeMs - ev.lastUpdatedAt) / (60 * 60 * 1e3));
  if (isHistorical) {
    return Math.max(0.72, Math.exp(-ageHours / 96));
  }
  const halfLifeHours = ev.category === "TRAFFIC" ? 2.5 : ev.category === "WEATHER" ? 4.5 : ev.category === "INCIDENT" ? 8 : 14;
  return Math.max(0.35, Math.exp(-Math.LN2 * ageHours / halfLifeHours));
}
function computeRiskSummaryForEvents(rawEvents, refTimeMs, isHistorical) {
  const dedupEvents = deduplicateHeatmapEvents(rawEvents);
  if (dedupEvents.length === 0) {
    return {
      riskScore: 0,
      riskLevel: "LOW",
      synergyBonus: 0,
      categoryBreakdown: {},
      categoryMaxSeverity: {},
      rawConfirmations: 0,
      dedupEvents: []
    };
  }
  const categoryBreakdown = {};
  const categoryMaxSeverity = {};
  const categoryWeightedHazards = {};
  let rawConfirmations = 0;
  for (const ev of dedupEvents) {
    rawConfirmations += Math.max(1, ev.confirmations);
    categoryBreakdown[ev.category] = (categoryBreakdown[ev.category] || 0) + 1;
    categoryMaxSeverity[ev.category] = Math.max(
      categoryMaxSeverity[ev.category] || 0,
      ev.severityScore
    );
    const relFactor = 0.58 + 0.42 * Math.min(1, Math.max(0.1, ev.reliability));
    const decay = getRecencyDecay(ev, refTimeMs, isHistorical);
    const effective = Math.min(
      100,
      ev.severityScore * ev.natureWeight * relFactor * decay
    );
    if (!categoryWeightedHazards[ev.category]) {
      categoryWeightedHazards[ev.category] = [];
    }
    categoryWeightedHazards[ev.category].push(effective);
  }
  const categoryScores = [];
  Object.keys(categoryWeightedHazards).forEach((cat) => {
    const sorted = categoryWeightedHazards[cat].sort((a, b) => b - a);
    const primary = sorted[0] || 0;
    const secondarySum = sorted.slice(1, 8).reduce((acc, v) => acc + v / 100, 0);
    const logTail = Math.min(9, 4.5 * Math.log(1 + secondarySum));
    categoryScores.push(Math.min(100, primary + logTail));
  });
  categoryScores.sort((a, b) => b - a);
  const dominant = categoryScores[0] || 0;
  let stacked = dominant;
  for (let i = 1; i < categoryScores.length; i++) {
    stacked += categoryScores[i] * Math.pow(0.22, i);
  }
  let synergyBonus = 0;
  const hasWeatherRisk = (categoryMaxSeverity.WEATHER || 0) >= 40;
  const hasInfraRisk = (categoryMaxSeverity.INFRASTRUCTURE || 0) >= 35;
  const hasIncidentOrAlert = (categoryMaxSeverity.INCIDENT || 0) >= 50 || (categoryMaxSeverity.EXTERNAL_ALERT || 0) >= 55;
  const hasTrafficRisk = (categoryMaxSeverity.TRAFFIC || 0) >= 45;
  if (hasWeatherRisk && hasInfraRisk) synergyBonus += 9;
  if (hasWeatherRisk && hasIncidentOrAlert) synergyBonus += 8;
  if (hasIncidentOrAlert && hasTrafficRisk) synergyBonus += 6;
  const combined = stacked + synergyBonus;
  const finalScore = combined <= 85 ? combined : 85 + 15 * (1 - Math.exp(-(combined - 85) / 18));
  const riskScore = Math.max(0, Math.min(100, Math.round(finalScore)));
  return {
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    synergyBonus: Math.round(synergyBonus),
    categoryBreakdown,
    categoryMaxSeverity,
    rawConfirmations,
    dedupEvents
  };
}
function clusterEventsIntoCells(events, zoom, refTimeMs, isHistorical) {
  const precision = getGeohashPrecisionForZoom(zoom);
  const groups = /* @__PURE__ */ new Map();
  for (const ev of events) {
    const gh = import_ngeohash2.default.encode(ev.lat, ev.lng, precision);
    const list = groups.get(gh) || [];
    list.push(ev);
    groups.set(gh, list);
  }
  const cells = [];
  for (const [gh, groupEvents] of groups.entries()) {
    const summary = computeRiskSummaryForEvents(
      groupEvents,
      refTimeMs,
      isHistorical
    );
    if (summary.dedupEvents.length === 0) continue;
    let wLat = 0;
    let wLng = 0;
    let wSum = 0;
    const sourcesSet = /* @__PURE__ */ new Set();
    let minCollected = Number.MAX_SAFE_INTEGER;
    let maxUpdated = 0;
    let relSum = 0;
    let topEvent = summary.dedupEvents[0];
    for (const ev of summary.dedupEvents) {
      const w = Math.max(10, ev.severityScore);
      wLat += ev.lat * w;
      wLng += ev.lng * w;
      wSum += w;
      sourcesSet.add(ev.source);
      if (ev.collectedAt < minCollected) minCollected = ev.collectedAt;
      if (ev.lastUpdatedAt > maxUpdated) maxUpdated = ev.lastUpdatedAt;
      relSum += ev.reliability;
      if (ev.severityScore > topEvent.severityScore) {
        topEvent = ev;
      }
    }
    const dominantCategory = Object.entries(summary.categoryMaxSeverity).sort(
      (a, b) => (b[1] || 0) - (a[1] || 0)
    )[0]?.[0] || topEvent.category;
    const heatIntensity = Number(
      Math.max(0.18, Math.min(1, summary.riskScore / 100)).toFixed(3)
    );
    cells.push({
      cellId: gh,
      geohash: gh,
      center: {
        lat: Number((wLat / wSum).toFixed(6)),
        lng: Number((wLng / wSum).toFixed(6))
      },
      riskScore: summary.riskScore,
      riskLevel: summary.riskLevel,
      heatIntensity,
      rawEventCount: summary.rawConfirmations,
      dedupEventCount: summary.dedupEvents.length,
      dominantCategory,
      categoryBreakdown: summary.categoryBreakdown,
      categoryMaxSeverity: summary.categoryMaxSeverity,
      synergyBonus: summary.synergyBonus,
      reliabilityAvg: Number((relSum / summary.dedupEvents.length).toFixed(2)),
      sources: Array.from(sourcesSet),
      topIssueSummary: topEvent.title,
      collectedAt: minCollected === Number.MAX_SAFE_INTEGER ? Date.now() : minCollected,
      lastUpdatedAt: maxUpdated || Date.now()
    });
  }
  return cells.sort((a, b) => b.riskScore - a.riskScore).slice(0, 650);
}
function boundsIntersect(b, latMin, latMax, lngMin, lngMax) {
  return b.northEast.lat >= latMin && b.southWest.lat <= latMax && b.northEast.lng >= lngMin && b.southWest.lng <= lngMax;
}
function detectRegionalCapabilities(bounds) {
  const spansWholeWorld = bounds.northEast.lng - bounds.southWest.lng > 55 || bounds.northEast.lat - bounds.southWest.lat > 35;
  const touchesParisIdf = boundsIntersect(bounds, 48.72, 48.96, 2.18, 2.52);
  const touchesLondonUk = boundsIntersect(bounds, 51.25, 51.72, -0.55, 0.35);
  const touchesFinland = boundsIntersect(bounds, 59.4, 70.2, 19, 31.6);
  const touchesUsLower48 = boundsIntersect(bounds, 24.4, 49.5, -125, -66.5);
  const centerLat = (bounds.northEast.lat + bounds.southWest.lat) / 2;
  const centerLng = (bounds.northEast.lng + bounds.southWest.lng) / 2;
  let regionLabel = "Zone Internationale";
  if (spansWholeWorld) {
    regionLabel = "Vue Mondiale Multi-Continents";
  } else if (touchesParisIdf && !spansWholeWorld) {
    regionLabel = "Europe \xB7 Paris / \xCEle-de-France";
  } else if (touchesLondonUk && !spansWholeWorld) {
    regionLabel = "Europe \xB7 Grand Londres (UK)";
  } else if (touchesFinland && !spansWholeWorld) {
    regionLabel = "Europe du Nord \xB7 Finlande";
  } else if (centerLat >= 35 && centerLat <= 71 && centerLng >= -12 && centerLng <= 42) {
    regionLabel = centerLat >= 54 ? "Europe du Nord" : "Europe Continentale";
  } else if (centerLat >= 15 && centerLat <= 72 && centerLng >= -168 && centerLng <= -52) {
    regionLabel = centerLat >= 24 ? "Am\xE9rique du Nord" : "Am\xE9rique Centrale & Cara\xEFbes";
  } else if (centerLat < 15 && centerLat >= -56 && centerLng >= -82 && centerLng <= -34) {
    regionLabel = "Am\xE9rique du Sud";
  } else if (centerLat >= -36 && centerLat <= 37.5 && centerLng >= -18 && centerLng <= 52) {
    regionLabel = centerLat >= 18 ? "Afrique du Nord & Sahara" : "Afrique Subsaharienne";
  } else if (centerLat >= 12 && centerLat <= 43 && centerLng > 34 && centerLng <= 63) {
    regionLabel = "Moyen-Orient & Golfe";
  } else if (centerLat >= -11 && centerLat <= 55 && centerLng > 63 && centerLng <= 150) {
    if (centerLng >= 100 && centerLat >= 20) regionLabel = "Asie de l'Est & Pacifique";
    else if (centerLat < 22) regionLabel = "Asie du Sud-Est";
    else regionLabel = "Asie Centrale & du Sud";
  } else if (centerLat >= -48 && centerLat <= -10 && centerLng >= 110 && centerLng <= 180) {
    regionLabel = "Oc\xE9anie & Australie";
  }
  return {
    spansWholeWorld,
    touchesParisIdf,
    touchesLondonUk,
    touchesFinland,
    touchesUsLower48,
    regionLabel
  };
}
async function fetchVruGuardSource(fetcher, bounds) {
  if (!fetcher) {
    const localCount = heatmapStore.queryEvents({
      minLat: bounds.southWest.lat,
      maxLat: bounds.northEast.lat,
      minLng: bounds.southWest.lng,
      maxLng: bounds.northEast.lng,
      startAt: Date.now() - 24 * 3600 * 1e3,
      endAt: Date.now(),
      includeExpired: false,
      sources: ["VRUGUARD_USER"]
    }).length;
    return {
      events: [],
      inBoundsCount: localCount,
      mode: "cached",
      detail: `Archive locale VRU Guard active (${localCount} dans la vue)`
    };
  }
  try {
    const [incidents, denms, pmrFeedback, infraAlerts] = await Promise.all([
      fetcher("incidents").catch(() => []),
      fetcher("denm_events").catch(() => []),
      fetcher("pmr_feedback").catch(() => []),
      fetcher("infrastructure_alerts").catch(() => [])
    ]);
    const normalized = [];
    for (const item of incidents) {
      const lat = Number(item.location?.lat ?? item.lat);
      const lng = Number(item.location?.lng ?? item.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const typeStr = String(item.type || "DANGER").toUpperCase();
      const sevStr = String(item.severity || "MEDIUM").toUpperCase();
      const category = typeStr === "ROADWORKS" || typeStr === "ROAD_CLOSED" ? "TRAFFIC" : "INCIDENT";
      let baseScore = sevStr === "HIGH" ? 76 : sevStr === "MEDIUM" ? 52 : 28;
      if (typeStr === "ACCIDENT") baseScore = Math.max(baseScore, 84);
      if (typeStr === "ROAD_CLOSED") baseScore = Math.max(baseScore, 68);
      if (typeStr === "SIDEWALK_CLOSED") baseScore = Math.max(baseScore, 58);
      const createdAt = Number(item.createdAt) || Date.now();
      const expiresAt = Number(item.expiresAt) || createdAt + 12 * 60 * 60 * 1e3;
      const reportsCount = Math.max(1, Number(item.reportsCount) || 1);
      const reliability = Math.min(
        0.95,
        0.72 + Math.min(4, reportsCount - 1) * 0.06
      );
      const gh = import_ngeohash2.default.encode(lat, lng, 7);
      normalized.push({
        id: `vru_inc_${item.id || gh}`,
        dedupKey: `${gh}:${category}:${typeStr}`,
        geohash: gh,
        lat,
        lng,
        category,
        subType: typeStr,
        title: `Signalement VRU : ${typeStr.replace(/_/g, " ")}`,
        description: item.description || `Incident routier signal\xE9 par la communaut\xE9 VRU Guard (${sevStr}).`,
        source: "VRUGUARD_USER",
        sourceLabel: "VRU Guard Sentinel",
        severityScore: baseScore,
        severityTier: severityTierFromScore(baseScore),
        reliability,
        confirmations: reportsCount,
        natureWeight: typeStr === "ACCIDENT" ? 1.12 : 1,
        collectedAt: createdAt,
        lastUpdatedAt: createdAt,
        expiresAt,
        status: item.status === "resolved" || item.status === "removed" ? "resolved" : "active"
      });
    }
    for (const denm of denms) {
      const lat = Number(denm.location?.lat ?? denm.lat);
      const lng = Number(denm.location?.lng ?? denm.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const riskStr = String(denm.riskLevel || "WARNING").toUpperCase();
      const score = riskStr === "CRITICAL" ? 88 : riskStr === "HIGH" ? 72 : riskStr === "WARNING" ? 48 : 22;
      const ts = Number(denm.timestamp) || Date.now();
      const expiresAt = Number(denm.expiresAt) || ts + 30 * 60 * 1e3;
      const gh = import_ngeohash2.default.encode(lat, lng, 7);
      const eventType = String(denm.eventType || "COLLISION_RISK");
      normalized.push({
        id: `vru_denm_${denm.id || gh}`,
        dedupKey: `${gh}:INCIDENT:DENM_${eventType}`,
        geohash: gh,
        lat,
        lng,
        category: "INCIDENT",
        subType: `DENM_${eventType}`,
        title: `Alerte V2X DENM (${eventType.replace(/_/g, " ")})`,
        description: `Message de s\xE9curit\xE9 coop\xE9ratif \xE9mis \xE0 proximit\xE9 (${riskStr}).`,
        source: "VRUGUARD_USER",
        sourceLabel: "VRU Guard Sentinel V2X",
        severityScore: score,
        severityTier: severityTierFromScore(score),
        reliability: 0.9,
        confirmations: 1,
        natureWeight: 1.1,
        collectedAt: ts,
        lastUpdatedAt: ts,
        expiresAt,
        status: "active"
      });
    }
    for (const pmr of pmrFeedback) {
      const lat = Number(pmr.location?.lat ?? pmr.lat);
      const lng = Number(pmr.location?.lng ?? pmr.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const score = pmr.isAccessible === false ? 64 : 36;
      const ts = Number(pmr.createdAt || pmr.timestamp) || Date.now();
      const gh = import_ngeohash2.default.encode(lat, lng, 7);
      normalized.push({
        id: `vru_pmr_${pmr.id || gh}`,
        dedupKey: `${gh}:INFRASTRUCTURE:PMR_${pmr.issueType || "BARRIER"}`,
        geohash: gh,
        lat,
        lng,
        category: "INFRASTRUCTURE",
        subType: String(pmr.issueType || "PMR_BARRIER"),
        title: "Obstacle accessibilit\xE9 PMR / Trottoir",
        description: pmr.comment || pmr.description || "Probl\xE8me de voirie ou d\u2019accessibilit\xE9 signal\xE9 par un usager vuln\xE9rable.",
        source: "VRUGUARD_USER",
        sourceLabel: "VRU Guard PMR",
        severityScore: score,
        severityTier: severityTierFromScore(score),
        reliability: 0.85,
        confirmations: 1,
        natureWeight: 1.04,
        collectedAt: ts,
        lastUpdatedAt: ts,
        expiresAt: null,
        status: "active"
      });
    }
    for (const inf of infraAlerts) {
      const lat = Number(inf.location?.lat ?? inf.lat);
      const lng = Number(inf.location?.lng ?? inf.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const ts = Number(inf.timestamp || inf.createdAt) || Date.now();
      const score = Number(inf.severityScore) || 58;
      const gh = import_ngeohash2.default.encode(lat, lng, 7);
      normalized.push({
        id: `vru_inf_${inf.id || gh}`,
        dedupKey: `${gh}:INFRASTRUCTURE:${inf.type || "HAZARD"}`,
        geohash: gh,
        lat,
        lng,
        category: "INFRASTRUCTURE",
        subType: String(inf.type || "INFRA_HAZARD"),
        title: String(inf.title || "Anomalie infrastructure d\xE9tect\xE9e"),
        description: String(
          inf.description || "Infrastructure routi\xE8re \xE0 vigilance renforc\xE9e."
        ),
        source: "VRUGUARD_USER",
        sourceLabel: "VRU Guard Sentinel",
        severityScore: score,
        severityTier: severityTierFromScore(score),
        reliability: 0.82,
        confirmations: 1,
        natureWeight: 1,
        collectedAt: ts,
        lastUpdatedAt: ts,
        expiresAt: null,
        status: "active"
      });
    }
    if (normalized.length > 0) {
      heatmapStore.ingestEvents(normalized);
    }
    const inBoundsCount = normalized.filter(
      (e) => e.lat >= bounds.southWest.lat && e.lat <= bounds.northEast.lat && e.lng >= bounds.southWest.lng && e.lng <= bounds.northEast.lng
    ).length;
    return {
      events: normalized,
      inBoundsCount,
      mode: "live",
      detail: `${inBoundsCount} signalement(s) VRU Guard dans l'emprise (${normalized.length} mondial)`
    };
  } catch (err) {
    return {
      events: [],
      inBoundsCount: 0,
      mode: "cached",
      detail: `Archive locale VRU Guard (${err.message})`
    };
  }
}
function describeWmoWeather(code) {
  if (code === null) return "Conditions variables";
  if (code === 0) return "Ciel d\xE9gag\xE9";
  if (code <= 3) return "Nuageux / \xC9claircies";
  if (code === 45 || code === 48) return "Brouillard / Visibilit\xE9 r\xE9duite";
  if (code >= 51 && code <= 57) return "Bruine / Pluie vergla\xE7ante";
  if (code >= 61 && code <= 67) return "Pluie mod\xE9r\xE9e \xE0 forte";
  if (code >= 71 && code <= 77) return "Neige / Risque verglas";
  if (code >= 80 && code <= 82) return "Averses violentes";
  if (code >= 95) return "Orage / Gr\xEAle s\xE9v\xE8re";
  return "Conditions m\xE9t\xE9o actives";
}
function describeMetNoSymbol(symbolCode) {
  const s = symbolCode.toLowerCase();
  if (s.includes("thunder")) return "Orage / Risque \xE9lectrique";
  if (s.includes("heavyrain")) return "Pluies intenses";
  if (s.includes("rain") || s.includes("sleet")) return "Pluie / Chauss\xE9e humide";
  if (s.includes("snow")) return "Chutes de neige / Verglas";
  if (s.includes("fog")) return "Brouillard dense";
  if (s.includes("clearsky") || s.includes("fair")) return "Ciel d\xE9gag\xE9";
  return "Nuageux / Couvert";
}
async function fetchMetNoWeatherFallback(lat, lng, now) {
  try {
    const url = `https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(
      4
    )}&lon=${lng.toFixed(4)}`;
    const resp = await fetch(url, {
      headers: {
        "User-Agent": "VRUGuardSentinel/1.0 contact@vruguard.org",
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(4e3)
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const first = json?.properties?.timeseries?.[0];
    const details = first?.data?.instant?.details;
    if (!details) return null;
    const temp = typeof details.air_temperature === "number" ? details.air_temperature : null;
    const windMs = typeof details.wind_speed === "number" ? details.wind_speed : 0;
    const windKmh = Math.round(windMs * 3.6);
    const fogFrac = typeof details.fog_area_fraction === "number" ? details.fog_area_fraction : 0;
    const next1h = first?.data?.next_1_hours;
    const precip = typeof next1h?.details?.precipitation_amount === "number" ? next1h.details.precipitation_amount : 0;
    const symbolCode = String(next1h?.summary?.symbol_code || "");
    const gh = import_ngeohash2.default.encode(lat, lng, 6);
    const expiresAt = now + 4 * 3600 * 1e3;
    const events = [];
    const flags = [];
    if (precip >= 10) {
      flags.push(`Pluie torrentielle MET.no (${precip.toFixed(1)} mm/h)`);
      events.push(
        buildWeatherEvent(
          gh,
          lat,
          lng,
          "FLOOD_RISK",
          "Fortes pluies / Risque inondation",
          `Pr\xE9cipitations intenses mesur\xE9es : ${precip.toFixed(1)} mm/h (MET Norway Fallback).`,
          precip >= 22 ? 84 : 68,
          now,
          expiresAt,
          "MET Norway (Failover)"
        )
      );
    } else if (precip >= 2.5 || symbolCode.includes("heavyrain")) {
      flags.push(`Pluie active MET.no (${precip.toFixed(1)} mm/h)`);
      events.push(
        buildWeatherEvent(
          gh,
          lat,
          lng,
          "HEAVY_RAIN",
          "Pluie mod\xE9r\xE9e \xE0 forte",
          `Chauss\xE9e mouill\xE9e d\xE9tect\xE9e via MET Norway (${precip.toFixed(1)} mm/h).`,
          precip >= 5 ? 52 : 34,
          now,
          expiresAt,
          "MET Norway (Failover)"
        )
      );
    }
    if (windKmh >= 45) {
      flags.push(`Vents forts MET.no (${windKmh} km/h)`);
      events.push(
        buildWeatherEvent(
          gh,
          lat,
          lng,
          "HIGH_WIND",
          "Vents forts / Risque lat\xE9ral VRU",
          `Vent soutenu \xE0 ${windKmh} km/h (MET Norway Fallback).`,
          windKmh >= 70 ? 72 : 50,
          now,
          expiresAt,
          "MET Norway (Failover)"
        )
      );
    }
    if (fogFrac >= 50 || symbolCode.includes("fog")) {
      flags.push("Brouillard dense MET.no");
      events.push(
        buildWeatherEvent(
          gh,
          lat,
          lng,
          "FOG",
          "Brouillard / Faible visibilit\xE9",
          "Visibilit\xE9 fortement r\xE9duite (MET Norway).",
          56,
          now,
          expiresAt,
          "MET Norway (Failover)"
        )
      );
    }
    if (temp !== null && (temp <= 1.5 || symbolCode.includes("snow"))) {
      flags.push(`Gel / Neige MET.no (${temp.toFixed(1)}\xB0C)`);
      events.push(
        buildWeatherEvent(
          gh,
          lat,
          lng,
          "ICE",
          "Risque gel / Verglas",
          `Temp\xE9rature ${temp.toFixed(1)}\xB0C \u2014 vigilance adh\xE9rence (MET Norway).`,
          temp <= 0 ? 68 : 46,
          now,
          expiresAt,
          "MET Norway (Failover)"
        )
      );
    }
    return {
      events,
      summary: {
        temperatureC: temp,
        precipitationMm: precip,
        windSpeedKmh: windKmh,
        windGustsKmh: windKmh,
        visibilityM: fogFrac >= 50 ? 600 : 1e4,
        weatherCode: null,
        conditionLabel: describeMetNoSymbol(symbolCode),
        riskFlags: flags,
        fetchedAt: now,
        providerName: "MET Norway Locationforecast 2.0"
      }
    };
  } catch {
    return null;
  }
}
async function fetchOpenMeteoSource(bounds, periodStartAt, periodEndAt, isHistoricalWindow) {
  const centerLat = Math.max(
    -85,
    Math.min(85, (bounds.northEast.lat + bounds.southWest.lat) / 2)
  );
  const centerLng = Math.max(
    -179.9,
    Math.min(179.9, (bounds.northEast.lng + bounds.southWest.lng) / 2)
  );
  const latSpan = Math.max(0.01, bounds.northEast.lat - bounds.southWest.lat);
  const lngSpan = Math.max(0.01, bounds.northEast.lng - bounds.southWest.lng);
  const samplePoints = [{ lat: centerLat, lng: centerLng }];
  if (latSpan > 0.04 || lngSpan > 0.04) {
    const dLat = Math.min(8, latSpan * 0.28);
    const dLng = Math.min(12, lngSpan * 0.28);
    samplePoints.push(
      {
        lat: Math.max(-85, Math.min(85, centerLat + dLat)),
        lng: Math.max(-179.9, Math.min(179.9, centerLng - dLng))
      },
      {
        lat: Math.max(-85, Math.min(85, centerLat + dLat)),
        lng: Math.max(-179.9, Math.min(179.9, centerLng + dLng))
      },
      {
        lat: Math.max(-85, Math.min(85, centerLat - dLat)),
        lng: Math.max(-179.9, Math.min(179.9, centerLng - dLng))
      },
      {
        lat: Math.max(-85, Math.min(85, centerLat - dLat)),
        lng: Math.max(-179.9, Math.min(179.9, centerLng + dLng))
      }
    );
  }
  const ghCenter = import_ngeohash2.default.encode(centerLat, centerLng, 4);
  const dayBucket = new Date(periodEndAt).toISOString().slice(0, 10);
  const cacheKey = `${ghCenter}:${isHistoricalWindow ? dayBucket : "now"}:${samplePoints.length}`;
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      events: cached.value.events,
      summary: cached.value.summary,
      mode: "cached",
      fallbackUsed: cached.value.fallbackUsed,
      detail: `${cached.value.providerLabel} (${samplePoints.length} points grille, cache 10 min)`
    };
  }
  const now = Date.now();
  const useArchiveApi = isHistoricalWindow && now - periodEndAt > 36 * 60 * 60 * 1e3;
  const events = [];
  let primarySummary = null;
  let fallbackUsed = null;
  let providerLabel = "Open-Meteo Mondial";
  try {
    if (useArchiveApi) {
      const startDate = new Date(periodStartAt).toISOString().slice(0, 10);
      const endDate = new Date(
        Math.min(periodEndAt, now - 24 * 3600 * 1e3)
      ).toISOString().slice(0, 10);
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${centerLat.toFixed(
        4
      )}&longitude=${centerLng.toFixed(
        4
      )}&start_date=${startDate}&end_date=${endDate}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max&timezone=UTC`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(4e3) });
      if (resp.ok) {
        const data = await resp.json();
        const daily = data?.daily;
        if (daily && Array.isArray(daily.time)) {
          let maxRain = 0;
          let maxWind = 0;
          let maxGust = 0;
          let minTemp = 99;
          let maxTemp = -99;
          let worstCode = 0;
          for (let i = 0; i < daily.time.length; i++) {
            const pSum = Number(daily.precipitation_sum?.[i] ?? 0);
            const wMax = Number(daily.wind_speed_10m_max?.[i] ?? 0);
            const gMax = Number(daily.wind_gusts_10m_max?.[i] ?? 0);
            const tMin = Number(daily.temperature_2m_min?.[i] ?? 15);
            const tMax = Number(daily.temperature_2m_max?.[i] ?? 20);
            const wCode = Number(daily.weather_code?.[i] ?? 0);
            if (pSum > maxRain) maxRain = pSum;
            if (wMax > maxWind) maxWind = wMax;
            if (gMax > maxGust) maxGust = gMax;
            if (tMin < minTemp) minTemp = tMin;
            if (tMax > maxTemp) maxTemp = tMax;
            if (wCode > worstCode) worstCode = wCode;
          }
          const gh = import_ngeohash2.default.encode(centerLat, centerLng, 6);
          const flags = [];
          if (maxRain >= 25) {
            flags.push(
              `Cumul pluie / risque inondation (${maxRain.toFixed(1)} mm/j)`
            );
            events.push(
              buildWeatherEvent(
                gh,
                centerLat,
                centerLng,
                "FLOOD_RISK",
                "Risque d\u2019inondation / Fortes pluies (Archive)",
                `Cumul journalier historique atteint : ${maxRain.toFixed(1)} mm.`,
                maxRain >= 50 ? 84 : 64,
                periodEndAt,
                null
              )
            );
          } else if (maxRain >= 10) {
            flags.push(`Pluies soutenues (${maxRain.toFixed(1)} mm/j)`);
            events.push(
              buildWeatherEvent(
                gh,
                centerLat,
                centerLng,
                "HEAVY_RAIN",
                "Chauss\xE9e mouill\xE9e / Fortes pluies",
                `Pr\xE9cipitations historiques jusqu\u2019\xE0 ${maxRain.toFixed(1)} mm/jour.`,
                44,
                periodEndAt,
                null
              )
            );
          }
          if (maxGust >= 65 || maxWind >= 50) {
            flags.push(
              `Rafales violentes (${Math.round(Math.max(maxGust, maxWind))} km/h)`
            );
            events.push(
              buildWeatherEvent(
                gh,
                centerLat,
                centerLng,
                "HIGH_WIND",
                "Vents violents / Rafales lat\xE9rales",
                `Rafales mesur\xE9es jusqu\u2019\xE0 ${Math.round(maxGust)} km/h (danger deux-roues/pi\xE9tons).`,
                maxGust >= 85 ? 76 : 54,
                periodEndAt,
                null
              )
            );
          }
          if (minTemp <= 1.5) {
            flags.push(`Gel / Verglas (${minTemp.toFixed(1)}\xB0C)`);
            events.push(
              buildWeatherEvent(
                gh,
                centerLat,
                centerLng,
                "ICE",
                "Risque de gel / Verglas",
                `Temp\xE9rature minimale de ${minTemp.toFixed(1)}\xB0C relev\xE9e sur la p\xE9riode.`,
                62,
                periodEndAt,
                null
              )
            );
          }
          primarySummary = {
            temperatureC: Number(((maxTemp + minTemp) / 2).toFixed(1)),
            precipitationMm: Number(maxRain.toFixed(1)),
            windSpeedKmh: Math.round(maxWind),
            windGustsKmh: Math.round(maxGust),
            visibilityM: worstCode === 45 || worstCode === 48 ? 500 : 1e4,
            weatherCode: worstCode,
            conditionLabel: describeWmoWeather(worstCode),
            riskFlags: flags,
            fetchedAt: now,
            providerName: "Open-Meteo Archive"
          };
        }
      }
    } else {
      const lats = samplePoints.map((p) => p.lat.toFixed(4)).join(",");
      const lngs = samplePoints.map((p) => p.lng.toFixed(4)).join(",");
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&current=temperature_2m,precipitation,rain,weather_code,wind_speed_10m,wind_gusts_10m,visibility&timezone=UTC`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(4e3) });
      if (resp.ok) {
        const rawJson = await resp.json();
        const items = Array.isArray(rawJson) ? rawJson : [rawJson];
        items.forEach((entry, idx) => {
          const pt = samplePoints[idx] || samplePoints[0];
          const cur = entry?.current;
          if (!cur) return;
          const temp = typeof cur.temperature_2m === "number" ? cur.temperature_2m : null;
          const precip = typeof cur.precipitation === "number" ? cur.precipitation : 0;
          const wind = typeof cur.wind_speed_10m === "number" ? cur.wind_speed_10m : 0;
          const gusts = typeof cur.wind_gusts_10m === "number" ? cur.wind_gusts_10m : 0;
          const vis = typeof cur.visibility === "number" ? cur.visibility : 15e3;
          const code = typeof cur.weather_code === "number" ? cur.weather_code : 0;
          const flags = [];
          const gh = import_ngeohash2.default.encode(pt.lat, pt.lng, 6);
          const expiresAt = now + 4 * 60 * 60 * 1e3;
          if (precip >= 10) {
            flags.push(
              `Pluie torrentielle / Inondation (${precip.toFixed(1)} mm/h)`
            );
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                "FLOOD_RISK",
                "Fortes pluies / Risque d\u2019inondation",
                `Pr\xE9cipitations intenses mesur\xE9es : ${precip.toFixed(1)} mm/h (Open-Meteo).`,
                precip >= 22 ? 84 : 68,
                now,
                expiresAt
              )
            );
          } else if (precip >= 2.5 || code >= 61 && code <= 67 || code >= 80 && code <= 82) {
            flags.push(`Pluie active (${precip.toFixed(1)} mm/h)`);
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                "HEAVY_RAIN",
                "Pluie mod\xE9r\xE9e \xE0 forte",
                `Chauss\xE9e glissante et distance de freinage allong\xE9e (${precip.toFixed(1)} mm/h).`,
                precip >= 5 ? 52 : 34,
                now,
                expiresAt
              )
            );
          }
          if (gusts >= 55 || wind >= 42) {
            const peak = Math.round(Math.max(gusts, wind));
            flags.push(`Vents forts (${peak} km/h)`);
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                "HIGH_WIND",
                "Vents violents / Risque d\xE9port lat\xE9ral",
                `Rafales jusqu\u2019\xE0 ${peak} km/h dangereuses pour cyclistes, trottinettes et pi\xE9tons.`,
                peak >= 75 ? 74 : 52,
                now,
                expiresAt
              )
            );
          }
          if (vis <= 1e3 || code === 45 || code === 48) {
            flags.push(`Brouillard / Visibilit\xE9 ${Math.round(vis)}m`);
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                "FOG",
                "Brouillard / Faible visibilit\xE9",
                `Visibilit\xE9 estim\xE9e \xE0 ${Math.round(vis)} m. D\xE9tection visuelle des VRU fortement r\xE9duite.`,
                vis <= 300 ? 72 : 48,
                now,
                expiresAt
              )
            );
          }
          if (temp !== null && (temp <= 1.5 || code >= 71 && code <= 77)) {
            flags.push(`Risque verglas / gel (${temp.toFixed(1)}\xB0C)`);
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                "ICE",
                "Risque de gel / Verglas",
                `Temp\xE9rature relev\xE9e \xE0 ${temp.toFixed(1)}\xB0C \u2014 adh\xE9rence critique sur passages pi\xE9tons et pistes.`,
                temp <= 0 ? 68 : 46,
                now,
                expiresAt
              )
            );
          }
          if (temp !== null && temp >= 37) {
            flags.push(`Forte chaleur (${temp.toFixed(1)}\xB0C)`);
            events.push(
              buildWeatherEvent(
                gh,
                pt.lat,
                pt.lng,
                "EXTREME_TEMP",
                "Canicule / Temp\xE9rature extr\xEAme",
                `Temp\xE9rature \xE9lev\xE9e (${temp.toFixed(1)}\xB0C) affectant la vigilance et l\u2019\xE9tat des chauss\xE9es.`,
                temp >= 41 ? 56 : 34,
                now,
                expiresAt
              )
            );
          }
          if (code >= 95) {
            flags.push("Orage violent / Vigilance officielle WMO");
            events.push({
              id: `official_wmo_${gh}_${now}`,
              dedupKey: `${gh}:EXTERNAL_ALERT:WMO_STORM`,
              geohash: gh,
              lat: pt.lat,
              lng: pt.lng,
              category: "EXTERNAL_ALERT",
              subType: "SEVERE_STORM_WMO",
              title: "Alerte M\xE9t\xE9o S\xE9v\xE8re : Orage / Gr\xEAle",
              description: `Code WMO ${code} d\xE9tect\xE9 par Open-Meteo \u2014 vigilance maximale requise.`,
              source: "OFFICIAL_ALERT",
              sourceLabel: "Vigilance M\xE9t\xE9o WMO",
              severityScore: 78,
              severityTier: "CRITICAL",
              reliability: 0.92,
              confirmations: 1,
              natureWeight: 1.08,
              collectedAt: now,
              lastUpdatedAt: now,
              expiresAt,
              status: "active"
            });
          }
          if (idx === 0) {
            primarySummary = {
              temperatureC: temp,
              precipitationMm: precip,
              windSpeedKmh: wind,
              windGustsKmh: gusts,
              visibilityM: vis,
              weatherCode: code,
              conditionLabel: describeWmoWeather(code),
              riskFlags: flags,
              fetchedAt: now,
              providerName: "Open-Meteo Global Forecast"
            };
          }
        });
      }
    }
  } catch {
  }
  if (!primarySummary) {
    const metNo = await fetchMetNoWeatherFallback(centerLat, centerLng, now);
    if (metNo) {
      events.push(...metNo.events);
      primarySummary = metNo.summary;
      fallbackUsed = "MET Norway Locationforecast 2.0";
      providerLabel = "MET Norway (Failover)";
    }
  }
  if (!primarySummary) {
    return {
      events: [],
      summary: null,
      mode: "unavailable",
      fallbackUsed: null,
      detail: "Fournisseurs m\xE9t\xE9o mondiaux (Open-Meteo & MET.no) indisponibles"
    };
  }
  if (events.length > 0) {
    heatmapStore.ingestEvents(events);
  }
  weatherCache.set(cacheKey, {
    expiresAt: now + 10 * 60 * 1e3,
    value: { events, summary: primarySummary, fallbackUsed, providerLabel }
  });
  return {
    events,
    summary: primarySummary,
    mode: "live",
    fallbackUsed,
    detail: fallbackUsed ? `Failover ${fallbackUsed} \xB7 ${primarySummary.conditionLabel} (${primarySummary.temperatureC ?? "\u2014"}\xB0C)` : `${primarySummary.conditionLabel} (${primarySummary.temperatureC ?? "\u2014"}\xB0C, ${events.length} al\xE9a(s))`
  };
}
function buildWeatherEvent(geohash6, lat, lng, subType, title, description, severityScore, timestamp, expiresAt, sourceLabel = "Open-Meteo") {
  return {
    id: `meteo_${geohash6}_${subType}_${timestamp}`,
    dedupKey: `${geohash6}:WEATHER:${subType}`,
    geohash: geohash6,
    lat,
    lng,
    category: "WEATHER",
    subType,
    title,
    description,
    source: "OPEN_METEO",
    sourceLabel,
    severityScore,
    severityTier: severityTierFromScore(severityScore),
    reliability: 0.92,
    confirmations: 1,
    natureWeight: subType === "FLOOD_RISK" || subType === "ICE" ? 1.08 : 0.98,
    collectedAt: timestamp,
    lastUpdatedAt: timestamp,
    expiresAt,
    status: "active"
  };
}
async function executeOverpassWithFailover(query) {
  let lastError = "Timeout";
  for (let i = 0; i < OVERPASS_MIRRORS.length; i++) {
    const mirror = OVERPASS_MIRRORS[i];
    try {
      const resp = await fetch(mirror.url, {
        method: "POST",
        headers: {
          "User-Agent": "vru-guard-heatmap/2.0",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "data=" + encodeURIComponent(query),
        signal: AbortSignal.timeout(6500)
      });
      if (resp.ok) {
        const data = await resp.json();
        const elements = Array.isArray(data?.elements) ? data.elements : [];
        return {
          ok: true,
          elements,
          mirrorUsed: i > 0 ? mirror.name : null
        };
      }
      lastError = `HTTP ${resp.status} (${mirror.name})`;
    } catch (err) {
      lastError = err.message;
    }
  }
  return {
    ok: false,
    elements: [],
    mirrorUsed: null,
    errorDetail: lastError
  };
}
async function ensureOsmRoadBaselineForPoint(lat, lng) {
  const gh5 = import_ngeohash2.default.encode(lat, lng, 5);
  const cached = osmRoadBaselineCache.get(gh5);
  if (cached && cached.expiresAt > Date.now()) {
    return { known: true, roadCount: cached.value };
  }
  const s = (lat - 0.01).toFixed(4);
  const n = (lat + 0.01).toFixed(4);
  const w = (lng - 0.012).toFixed(4);
  const e = (lng + 0.012).toFixed(4);
  const q = `[out:json][timeout:4]; way["highway"~"primary|secondary|tertiary|residential|unclassified|trunk"](${s},${w},${n},${e}); out ids 25;`;
  const res = await executeOverpassWithFailover(q);
  if (!res.ok) return { known: false, roadCount: 0 };
  const roadCount = res.elements.length;
  osmRoadBaselineCache.set(gh5, {
    expiresAt: Date.now() + 30 * 60 * 1e3,
    value: roadCount
  });
  return { known: true, roadCount };
}
async function fetchOpenStreetMapSource(bounds, zoom) {
  if (zoom < 10) {
    return {
      events: [],
      mode: "derived",
      mappedWayCount: 0,
      zoomDeferred: true,
      fallbackUsed: null,
      detail: `Vue globale (Zoom ${zoom}) \u2014 zoomez (\u2265 10) pour analyser la voirie OSM`
    };
  }
  const centerLat = (bounds.northEast.lat + bounds.southWest.lat) / 2;
  const centerLng = (bounds.northEast.lng + bounds.southWest.lng) / 2;
  const halfLat = Math.min(
    0.025,
    Math.max(8e-3, (bounds.northEast.lat - bounds.southWest.lat) / 2)
  );
  const halfLng = Math.min(
    0.032,
    Math.max(0.01, (bounds.northEast.lng - bounds.southWest.lng) / 2)
  );
  const s = (centerLat - halfLat).toFixed(4);
  const n = (centerLat + halfLat).toFixed(4);
  const w = (centerLng - halfLng).toFixed(4);
  const e = (centerLng + halfLng).toFixed(4);
  const gridKey = import_ngeohash2.default.encode(centerLat, centerLng, 5);
  const cached = osmCache.get(gridKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      events: cached.value.events,
      mode: "cached",
      mappedWayCount: cached.value.mappedWayCount,
      zoomDeferred: false,
      fallbackUsed: cached.value.mirrorUsed,
      detail: cached.value.mappedWayCount === 0 ? "Aucune voie OSM cartographi\xE9e dans cette zone (cache)" : `${cached.value.events.length} al\xE9a(s) voirie OSM index\xE9s (cache)`
    };
  }
  const query = `
    [out:json][timeout:6];
    (
      way["highway"="construction"](${s},${w},${n},${e});
      way["highway"]["access"="no"](${s},${w},${n},${e});
      way["highway"~"primary|trunk"]["lit"="no"](${s},${w},${n},${e});
      way["highway"]["smoothness"~"bad|very_bad|horrible"](${s},${w},${n},${e});
      node["highway"="crossing"]["crossing"="unmarked"](${s},${w},${n},${e});
    );
    out center 80;
    way["highway"~"primary|secondary|tertiary|residential"](${s},${w},${n},${e});
    out ids 15;
  `;
  const res = await executeOverpassWithFailover(query);
  if (!res.ok) {
    return {
      events: cached?.value.events || [],
      mode: cached ? "cached" : "unavailable",
      mappedWayCount: cached?.value.mappedWayCount ?? 0,
      zoomDeferred: false,
      fallbackUsed: null,
      detail: `Overpass miroirs indisponibles (${res.errorDetail})`
    };
  }
  const now = Date.now();
  const events = [];
  let mappedWayCount = 0;
  for (const el of res.elements) {
    if (el.type === "way" && !el.tags && !el.center) {
      mappedWayCount += 1;
      continue;
    }
    const lat = Number(el.lat ?? el.center?.lat);
    const lng = Number(el.lon ?? el.center?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    mappedWayCount += 1;
    const tags = el.tags || {};
    const gh = import_ngeohash2.default.encode(lat, lng, 7);
    if (tags.highway === "construction" || tags.access === "no") {
      const sev = tags.access === "no" ? 66 : 52;
      events.push({
        id: `osm_${el.type}_${el.id}`,
        dedupKey: `${gh}:TRAFFIC:OSM_${tags.highway === "construction" ? "CONSTRUCTION" : "CLOSED"}`,
        geohash: gh,
        lat,
        lng,
        category: "TRAFFIC",
        subType: tags.highway === "construction" ? "ROAD_WORK" : "ROAD_CLOSED",
        title: tags.highway === "construction" ? `Travaux OSM (${tags.name || "Voirie en chantier"})` : `Voie ferm\xE9e / Acc\xE8s interdit (${tags.name || "OSM"})`,
        description: "Restriction de circulation d\xE9tect\xE9e dans les m\xE9tadonn\xE9es OpenStreetMap.",
        source: "OPENSTREETMAP",
        sourceLabel: "OpenStreetMap",
        severityScore: sev,
        severityTier: severityTierFromScore(sev),
        reliability: 0.88,
        confirmations: 1,
        natureWeight: 0.96,
        collectedAt: now,
        lastUpdatedAt: now,
        expiresAt: now + 7 * 24 * 60 * 60 * 1e3,
        status: "active"
      });
    } else if (tags.highway === "crossing") {
      const isUnmarked = tags.crossing === "unmarked";
      const sev = isUnmarked ? 56 : 40;
      events.push({
        id: `osm_${el.type}_${el.id}`,
        dedupKey: `${gh}:INFRASTRUCTURE:OSM_CROSSING`,
        geohash: gh,
        lat,
        lng,
        category: "INFRASTRUCTURE",
        subType: isUnmarked ? "UNMARKED_CROSSING" : "UNSIGNALED_CROSSING",
        title: isUnmarked ? "Passage pi\xE9ton non mat\xE9rialis\xE9 (OSM)" : "Travers\xE9e pi\xE9tonne sans feu tricolore",
        description: `${tags.name || "Intersection"} \u2014 Zone de conflit VRU/v\xE9hicules sans signalisation lumineuse.`,
        source: "OPENSTREETMAP",
        sourceLabel: "OpenStreetMap",
        severityScore: sev,
        severityTier: severityTierFromScore(sev),
        reliability: 0.9,
        confirmations: 1,
        natureWeight: 1.05,
        collectedAt: now,
        lastUpdatedAt: now,
        expiresAt: null,
        status: "active"
      });
    } else if (tags.lit === "no") {
      const sev = tags.highway === "trunk" || tags.highway === "primary" ? 58 : 44;
      events.push({
        id: `osm_${el.type}_${el.id}`,
        dedupKey: `${gh}:INFRASTRUCTURE:OSM_UNLIT`,
        geohash: gh,
        lat,
        lng,
        category: "INFRASTRUCTURE",
        subType: "UNLIT_ROAD",
        title: `Axe principal sans \xE9clairage (${tags.name || tags.highway})`,
        description: "Absence d\u2019\xE9clairage public signal\xE9e sur OpenStreetMap (risque nocturne VRU).",
        source: "OPENSTREETMAP",
        sourceLabel: "OpenStreetMap",
        severityScore: sev,
        severityTier: severityTierFromScore(sev),
        reliability: 0.89,
        confirmations: 1,
        natureWeight: 1.02,
        collectedAt: now,
        lastUpdatedAt: now,
        expiresAt: null,
        status: "active"
      });
    } else if (tags.smoothness) {
      const sev = tags.smoothness === "horrible" ? 54 : 38;
      events.push({
        id: `osm_${el.type}_${el.id}`,
        dedupKey: `${gh}:INFRASTRUCTURE:OSM_SURFACE`,
        geohash: gh,
        lat,
        lng,
        category: "INFRASTRUCTURE",
        subType: "POOR_SURFACE",
        title: `Chauss\xE9e d\xE9grad\xE9e (${tags.smoothness})`,
        description: `\xC9tat de surface difficile (${tags.surface || tags.smoothness}) pour cycles, PMR et trottinettes.`,
        source: "OPENSTREETMAP",
        sourceLabel: "OpenStreetMap",
        severityScore: sev,
        severityTier: severityTierFromScore(sev),
        reliability: 0.86,
        confirmations: 1,
        natureWeight: 0.95,
        collectedAt: now,
        lastUpdatedAt: now,
        expiresAt: null,
        status: "active"
      });
    }
  }
  osmRoadBaselineCache.set(gridKey, {
    expiresAt: now + 30 * 60 * 1e3,
    value: mappedWayCount
  });
  if (events.length > 0) {
    heatmapStore.ingestEvents(events);
  }
  osmCache.set(gridKey, {
    expiresAt: now + 20 * 60 * 1e3,
    value: { events, mappedWayCount, mirrorUsed: res.mirrorUsed }
  });
  return {
    events,
    mode: "live",
    mappedWayCount,
    zoomDeferred: false,
    fallbackUsed: res.mirrorUsed,
    detail: mappedWayCount === 0 ? "Zone non cartographi\xE9e sur OSM (0 voie d\xE9tect\xE9e)" : `${events.length} point(s) infrastructure \xB7 ${mappedWayCount} routes OSM`
  };
}
async function fetchTrafficApiSource(bounds, zoom) {
  const cap = detectRegionalCapabilities(bounds);
  const centerLat = (bounds.northEast.lat + bounds.southWest.lat) / 2;
  const centerLng = (bounds.northEast.lng + bounds.southWest.lng) / 2;
  const gridKey = `open_traffic_${zoom >= 10 ? import_ngeohash2.default.encode(centerLat, centerLng, 5) : import_ngeohash2.default.encode(centerLat, centerLng, 3)}`;
  const cached = trafficCache.get(gridKey);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      ...cached.value,
      mode: "cached"
    };
  }
  const now = Date.now();
  const expiresAt = now + 2 * 60 * 60 * 1e3;
  const events = [];
  const activeProviders = [];
  let hasRegionalLiveFeed = false;
  let fallbackUsed = null;
  if (zoom >= 10) {
    const halfLat = Math.min(
      0.025,
      Math.max(8e-3, (bounds.northEast.lat - bounds.southWest.lat) / 2)
    );
    const halfLng = Math.min(
      0.032,
      Math.max(0.01, (bounds.northEast.lng - bounds.southWest.lng) / 2)
    );
    const s = (centerLat - halfLat).toFixed(4);
    const n = (centerLat + halfLat).toFixed(4);
    const w = (centerLng - halfLng).toFixed(4);
    const e = (centerLng + halfLng).toFixed(4);
    const overpassTrafficQuery = `
      [out:json][timeout:6];
      (
        way["highway"="construction"](${s},${w},${n},${e});
        way["highway"]["access"="no"](${s},${w},${n},${e});
        node["railway"="level_crossing"](${s},${w},${n},${e});
        way["highway"~"trunk|primary"]["junction"="roundabout"](${s},${w},${n},${e});
      );
      out center 70;
    `;
    const osmTraf = await executeOverpassWithFailover(overpassTrafficQuery);
    if (osmTraf.ok) {
      activeProviders.push("OSM Traffic Global");
      if (osmTraf.mirrorUsed) fallbackUsed = osmTraf.mirrorUsed;
      for (const el of osmTraf.elements) {
        const lat = Number(el.lat ?? el.center?.lat);
        const lng = Number(el.lon ?? el.center?.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
        const tags = el.tags || {};
        const gh = import_ngeohash2.default.encode(lat, lng, 7);
        let subType = "BOTTLENECK";
        let title = "Point de congestion / intersection majeure";
        let desc = "Flux routier dense d\xE9tect\xE9 sur axe principal (OpenStreetMap).";
        let sev = 38;
        if (tags.highway === "construction") {
          subType = "ROAD_WORK";
          title = `Travaux routiers (${tags.name || "Chantier"})`;
          desc = "Zone de travaux et r\xE9tr\xE9cissement de voie (OpenStreetMap).";
          sev = 56;
        } else if (tags.access === "no") {
          subType = "ROAD_CLOSED";
          title = `Voie ferm\xE9e / Acc\xE8s restreint (${tags.name || "Voirie"})`;
          desc = "Circulation automobile restreinte ou ferm\xE9e (OpenStreetMap).";
          sev = 66;
        } else if (tags.railway === "level_crossing") {
          subType = "LEVEL_CROSSING";
          title = "Passage \xE0 niveau (ralentissement & conflit VRU)";
          desc = "Intersection rail/route \xE0 vigilance accrue.";
          sev = 52;
        } else if (tags.junction === "roundabout") {
          subType = "ARTERIAL_ROUNDABOUT";
          title = `Carrefour giratoire majeur (${tags.name || tags.highway})`;
          desc = "Point de convergence multi-flux fr\xE9quemment congestionn\xE9.";
          sev = 44;
        }
        events.push({
          id: `osm_traf_${el.type}_${el.id}`,
          dedupKey: `${gh}:TRAFFIC:${subType}`,
          geohash: gh,
          lat,
          lng,
          category: "TRAFFIC",
          subType,
          title,
          description: desc,
          source: "TRAFFIC_API",
          sourceLabel: "Open Traffic (OSM)",
          severityScore: sev,
          severityTier: severityTierFromScore(sev),
          reliability: 0.88,
          confirmations: 1,
          natureWeight: 0.94,
          collectedAt: now,
          lastUpdatedAt: now,
          expiresAt,
          status: "active"
        });
      }
    }
  }
  if (cap.touchesParisIdf) {
    try {
      const parisCache = regionalFeedCache.get("paris");
      let rows = parisCache && parisCache.expiresAt > now ? parisCache.value : null;
      if (!rows) {
        const resp = await fetch(
          "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/chantiers-perturbants/records?limit=60",
          { signal: AbortSignal.timeout(3500) }
        );
        if (resp.ok) {
          const data = await resp.json();
          const list = Array.isArray(data?.results) ? data.results : [];
          rows = [];
          for (const r of list) {
            const lat = Number(r.geo_point_2d?.lat);
            const lng = Number(r.geo_point_2d?.lon);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const gh = import_ngeohash2.default.encode(lat, lng, 7);
            const impact = String(r.impact_circulation || "").toUpperCase();
            const sev = impact.includes("BARR") ? 70 : 52;
            rows.push({
              id: `paris_${r.identifiant || gh}`,
              dedupKey: `${gh}:TRAFFIC:PARIS_WORK`,
              geohash: gh,
              lat,
              lng,
              category: "TRAFFIC",
              subType: impact.includes("BARR") ? "ROAD_CLOSED" : "ROAD_WORK",
              title: String(r.objet || "Chantier perturbant (Paris Open Data)"),
              description: `${r.voie || "Voirie"} \u2014 Impact : ${r.impact_circulation || "Circulation perturb\xE9e"}.`,
              source: "TRAFFIC_API",
              sourceLabel: "Paris Open Data (Gratuit)",
              severityScore: sev,
              severityTier: severityTierFromScore(sev),
              reliability: 0.95,
              confirmations: 1,
              natureWeight: 0.95,
              collectedAt: now,
              lastUpdatedAt: now,
              expiresAt,
              status: "active"
            });
          }
          regionalFeedCache.set("paris", {
            expiresAt: now + 10 * 60 * 1e3,
            value: rows
          });
        }
      }
      if (rows) {
        events.push(...rows);
        activeProviders.push("Paris Open Data");
        hasRegionalLiveFeed = true;
      }
    } catch {
    }
  }
  if (cap.touchesLondonUk) {
    try {
      const tflCache = regionalFeedCache.get("tfl");
      let rows = tflCache && tflCache.expiresAt > now ? tflCache.value : null;
      if (!rows) {
        const tflResp = await fetch(
          "https://api.tfl.gov.uk/Road/all/Disruption",
          { signal: AbortSignal.timeout(3500) }
        );
        if (tflResp.ok) {
          const list = await tflResp.json();
          rows = [];
          for (const r of list.slice(0, 70)) {
            const pt = Array.isArray(r.point) ? r.point : typeof r.point === "string" ? r.point.replace(/[\[\]]/g, "").split(",").map(Number) : null;
            const lng = Number(pt?.[0]);
            const lat = Number(pt?.[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const gh = import_ngeohash2.default.encode(lat, lng, 7);
            const sevStr = String(r.severity || "Moderate").toLowerCase();
            const sev = sevStr.includes("serious") || sevStr.includes("severe") ? 72 : 48;
            rows.push({
              id: `tfl_${r.id || gh}`,
              dedupKey: `${gh}:TRAFFIC:TFL_DISRUPTION`,
              geohash: gh,
              lat,
              lng,
              category: "TRAFFIC",
              subType: String(r.category || "TRAFFIC_DISRUPTION").toUpperCase(),
              title: String(r.location || r.category || "Perturbation Trafic TfL"),
              description: String(
                r.comments || "Perturbation signal\xE9e par Transport for London Open Data."
              ),
              source: "TRAFFIC_API",
              sourceLabel: "TfL Open API (Gratuit)",
              severityScore: sev,
              severityTier: severityTierFromScore(sev),
              reliability: 0.95,
              confirmations: 1,
              natureWeight: 0.95,
              collectedAt: now,
              lastUpdatedAt: now,
              expiresAt,
              status: "active"
            });
          }
          regionalFeedCache.set("tfl", {
            expiresAt: now + 8 * 60 * 1e3,
            value: rows
          });
        }
      }
      if (rows) {
        events.push(...rows);
        activeProviders.push("TfL London Open API");
        hasRegionalLiveFeed = true;
      }
    } catch {
    }
  }
  if (cap.touchesFinland) {
    try {
      const finCache = regionalFeedCache.get("fintraffic");
      let rows = finCache && finCache.expiresAt > now ? finCache.value : null;
      if (!rows) {
        const resp = await fetch(
          "https://tie.digitraffic.fi/api/traffic-message/v1/messages?inactiveHours=0&situationType=TRAFFIC_ANNOUNCEMENT",
          { signal: AbortSignal.timeout(4e3) }
        );
        if (resp.ok) {
          const geo = await resp.json();
          const features = Array.isArray(geo?.features) ? geo.features : [];
          rows = [];
          for (const f of features.slice(0, 75)) {
            const geom = f?.geometry;
            let coord = null;
            if (geom?.type === "Point") coord = geom.coordinates;
            else if (geom?.type === "MultiPoint") coord = geom.coordinates?.[0];
            else if (geom?.type === "LineString") coord = geom.coordinates?.[0];
            const lng = Number(coord?.[0]);
            const lat = Number(coord?.[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
            const ann = f?.properties?.announcements?.[0];
            const gh = import_ngeohash2.default.encode(lat, lng, 7);
            const title = ann?.title || f?.properties?.situationType || "Perturbation routi\xE8re Fintraffic";
            const sev = String(title).toLowerCase().includes("closed") ? 74 : 52;
            rows.push({
              id: `fintraffic_${f.properties?.situationId || gh}`,
              dedupKey: `${gh}:TRAFFIC:FINTRAFFIC`,
              geohash: gh,
              lat,
              lng,
              category: "TRAFFIC",
              subType: "TRAFFIC_ANNOUNCEMENT",
              title: String(title),
              description: String(
                ann?.location?.description || ann?.comment || "Incident de circulation officiel Fintraffic Digitraffic."
              ),
              source: "TRAFFIC_API",
              sourceLabel: "Fintraffic Digitraffic (Finlande)",
              severityScore: sev,
              severityTier: severityTierFromScore(sev),
              reliability: 0.96,
              confirmations: 1,
              natureWeight: 0.98,
              collectedAt: now,
              lastUpdatedAt: now,
              expiresAt,
              status: "active"
            });
          }
          regionalFeedCache.set("fintraffic", {
            expiresAt: now + 10 * 60 * 1e3,
            value: rows
          });
        }
      }
      if (rows) {
        events.push(...rows);
        activeProviders.push("Fintraffic Finlande");
        hasRegionalLiveFeed = true;
      }
    } catch {
    }
  }
  if (cap.touchesUsLower48 && !cap.spansWholeWorld) {
    try {
      const nwsResp = await fetch(
        `https://api.weather.gov/alerts/active?point=${centerLat.toFixed(
          4
        )},${centerLng.toFixed(4)}`,
        {
          headers: {
            "User-Agent": "VRUGuardSentinel/1.0 contact@vruguard.org",
            Accept: "application/geo+json"
          },
          signal: AbortSignal.timeout(3500)
        }
      );
      if (nwsResp.ok) {
        const geo = await nwsResp.json();
        const feats = Array.isArray(geo?.features) ? geo.features : [];
        activeProviders.push("NOAA NWS (USA)");
        hasRegionalLiveFeed = true;
        for (const f of feats.slice(0, 10)) {
          const p = f?.properties || {};
          const gh = import_ngeohash2.default.encode(centerLat, centerLng, 6);
          const sevStr = String(p.severity || "Moderate").toLowerCase();
          const sev = sevStr === "extreme" ? 88 : sevStr === "severe" ? 74 : sevStr === "moderate" ? 52 : 34;
          events.push({
            id: `nws_${p.id || gh}`,
            dedupKey: `${gh}:EXTERNAL_ALERT:NWS_${p.event || "ALERT"}`,
            geohash: gh,
            lat: centerLat,
            lng: centerLng,
            category: "EXTERNAL_ALERT",
            subType: "NWS_ADVISORY",
            title: String(p.event || p.headline || "Vigilance officielle NOAA NWS"),
            description: String(
              p.headline || p.description || "Alerte active NOAA / NWS."
            ).slice(0, 220),
            source: "OFFICIAL_ALERT",
            sourceLabel: "NOAA NWS Open API (USA)",
            severityScore: sev,
            severityTier: severityTierFromScore(sev),
            reliability: 0.96,
            confirmations: 1,
            natureWeight: 1.05,
            collectedAt: now,
            lastUpdatedAt: now,
            expiresAt,
            status: "active"
          });
        }
      }
    } catch {
    }
  }
  if (events.length > 0) {
    heatmapStore.ingestEvents(events);
  }
  const result = {
    events,
    configured: true,
    activeProviders,
    hasRegionalLiveFeed,
    fallbackUsed,
    mode: activeProviders.length > 0 ? "live" : zoom < 10 ? "derived" : "cached",
    detail: activeProviders.length > 0 ? `${activeProviders.join(" + ")} \xB7 ${events.length} flux` : zoom < 10 ? "Couverture trafic locale : zoomez au niveau ville ou utilisez un portail r\xE9gional" : "Aucune donn\xE9e trafic temps r\xE9el municipale dans ce secteur (VRU & OSM uniquement)"
  };
  trafficCache.set(gridKey, {
    expiresAt: now + 8 * 60 * 1e3,
    value: result
  });
  return result;
}
async function fetchOfficialExternalAlertsSource(bounds) {
  const now = Date.now();
  const cached = globalAlertsCache.get("world");
  let allGlobalAlerts = [];
  let activeProviders = [];
  let fallbackUsed = null;
  let mode = "live";
  if (cached && cached.expiresAt > now) {
    allGlobalAlerts = cached.value.events;
    activeProviders = cached.value.activeProviders;
    fallbackUsed = cached.value.fallbackUsed;
    mode = "cached";
  } else {
    const [gdacsRes, usgsRes, eonetRes] = await Promise.allSettled([
      fetch(
        "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?eventlist=EQ,TC,FL,VO,WF,DR&alertlevel=Orange;Red",
        { signal: AbortSignal.timeout(4e3) }
      ),
      fetch(
        "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
        { signal: AbortSignal.timeout(4e3) }
      ),
      fetch(
        "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=60",
        { signal: AbortSignal.timeout(4e3) }
      )
    ]);
    if (gdacsRes.status === "fulfilled" && gdacsRes.value.ok) {
      try {
        const geo = await gdacsRes.value.json();
        const features = Array.isArray(geo?.features) ? geo.features : [];
        activeProviders.push("GDACS");
        for (const f of features.slice(0, 80)) {
          const coords = f?.geometry?.coordinates;
          const lng = Number(coords?.[0]);
          const lat = Number(coords?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const props = f.properties || {};
          const level = String(props.alertlevel || "Orange").toLowerCase();
          const score = level === "red" ? 88 : 66;
          const gh = import_ngeohash2.default.encode(lat, lng, 6);
          const fromMs = Date.parse(props.fromdate || "") || now;
          const toMs = Date.parse(props.todate || "") || now + 48 * 60 * 60 * 1e3;
          allGlobalAlerts.push({
            id: `gdacs_${props.eventtype || "AL"}_${props.eventid || gh}`,
            dedupKey: `${gh}:EXTERNAL_ALERT:GDACS_${props.eventtype || "ALERT"}`,
            geohash: gh,
            lat,
            lng,
            category: "EXTERNAL_ALERT",
            subType: `OFFICIAL_${props.eventtype || "DISASTER"}`,
            title: String(
              props.name || props.htmldescription || "Alerte officielle GDACS"
            ),
            description: `${props.country || "Alerte mondiale"} \u2014 Niveau ${props.alertlevel || "Orange"}.`,
            source: "OFFICIAL_ALERT",
            sourceLabel: "GDACS Open API",
            severityScore: score,
            severityTier: severityTierFromScore(score),
            reliability: 0.96,
            confirmations: 1,
            natureWeight: 1.1,
            collectedAt: fromMs,
            lastUpdatedAt: now,
            expiresAt: toMs,
            status: "active"
          });
        }
      } catch {
      }
    }
    if (usgsRes.status === "fulfilled" && usgsRes.value.ok) {
      try {
        const usgs = await usgsRes.value.json();
        const features = Array.isArray(usgs?.features) ? usgs.features : [];
        activeProviders.push("USGS");
        for (const f of features.slice(0, 80)) {
          const coords = f?.geometry?.coordinates;
          const lng = Number(coords?.[0]);
          const lat = Number(coords?.[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const props = f.properties || {};
          const mag = Number(props.mag || 2.5);
          const score = mag >= 5.5 ? 88 : mag >= 4.5 ? 68 : 44;
          const gh = import_ngeohash2.default.encode(lat, lng, 6);
          const evTime = Number(props.time) || now;
          allGlobalAlerts.push({
            id: `usgs_${f.id || gh}`,
            dedupKey: `${gh}:EXTERNAL_ALERT:USGS_EQ`,
            geohash: gh,
            lat,
            lng,
            category: "EXTERNAL_ALERT",
            subType: "SEISMIC_ALERT",
            title: String(
              props.title || `Secousse sismique M${mag.toFixed(1)}`
            ),
            description: `Alerte sismique USGS (magnitude ${mag.toFixed(1)}) \u2014 vigilance infrastructures.`,
            source: "OFFICIAL_ALERT",
            sourceLabel: "USGS Open Feed",
            severityScore: score,
            severityTier: severityTierFromScore(score),
            reliability: 0.97,
            confirmations: 1,
            natureWeight: 1.08,
            collectedAt: evTime,
            lastUpdatedAt: evTime,
            expiresAt: evTime + 48 * 60 * 60 * 1e3,
            status: "active"
          });
        }
      } catch {
      }
    }
    if (eonetRes.status === "fulfilled" && eonetRes.value.ok) {
      try {
        const eonet = await eonetRes.value.json();
        const eventsList = Array.isArray(eonet?.events) ? eonet.events : [];
        activeProviders.push("NASA EONET");
        for (const ev of eventsList.slice(0, 60)) {
          const lastGeom = ev?.geometry?.[ev.geometry.length - 1] || ev?.geometry?.[0];
          const coords = lastGeom?.coordinates;
          if (!Array.isArray(coords) || coords.length < 2) continue;
          const lng = Number(coords[0]);
          const lat = Number(coords[1]);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const catTitle = String(
            ev?.categories?.[0]?.title || "Natural Event"
          );
          const catLower = catTitle.toLowerCase();
          const score = catLower.includes("wildfire") || catLower.includes("storm") || catLower.includes("volcano") ? 76 : 62;
          const gh = import_ngeohash2.default.encode(lat, lng, 6);
          const evMs = Date.parse(lastGeom?.date || "") || now;
          allGlobalAlerts.push({
            id: `eonet_${ev.id || gh}`,
            dedupKey: `${gh}:EXTERNAL_ALERT:EONET_${catLower.replace(/\s+/g, "_")}`,
            geohash: gh,
            lat,
            lng,
            category: "EXTERNAL_ALERT",
            subType: `EONET_${catLower.toUpperCase().replace(/\s+/g, "_")}`,
            title: String(ev.title || `\xC9v\xE9nement naturel (${catTitle})`),
            description: `Observation satellite NASA EONET (${catTitle}) \u2014 perturbation environnementale majeure.`,
            source: "OFFICIAL_ALERT",
            sourceLabel: "NASA EONET v3",
            severityScore: score,
            severityTier: severityTierFromScore(score),
            reliability: 0.94,
            confirmations: 1,
            natureWeight: 1.06,
            collectedAt: evMs,
            lastUpdatedAt: evMs,
            expiresAt: now + 48 * 60 * 60 * 1e3,
            status: "active"
          });
        }
      } catch {
      }
    }
    if (activeProviders.length > 0 && activeProviders.length < 3) {
      fallbackUsed = `Tol\xE9rance active (${activeProviders.join(" + ")})`;
    }
    if (allGlobalAlerts.length > 0) {
      heatmapStore.ingestEvents(allGlobalAlerts);
    }
    globalAlertsCache.set("world", {
      expiresAt: now + 15 * 60 * 1e3,
      value: { events: allGlobalAlerts, activeProviders, fallbackUsed }
    });
  }
  const localMatches = allGlobalAlerts.filter(
    (a) => a.lat >= bounds.southWest.lat && a.lat <= bounds.northEast.lat && a.lng >= bounds.southWest.lng && a.lng <= bounds.northEast.lng
  );
  return {
    events: localMatches,
    mode: activeProviders.length > 0 ? mode : "unavailable",
    activeProviders,
    fallbackUsed,
    detail: activeProviders.length > 0 ? `${activeProviders.join(" + ")} actifs (${localMatches.length} alerte(s) dans l'emprise)` : "Flux alertes officielles mondiales temporairement injoignables"
  };
}
function evaluateRegionCoverage(params) {
  const cap = detectRegionalCapabilities(params.bounds);
  const regionalTrafficProviders = params.trafficProviders.filter(
    (p) => p !== "OSM Traffic Global"
  );
  const weatherLevel = params.meteoMode === "unavailable" ? "NONE" : "FULL";
  const officialLevel = params.officialMode === "unavailable" ? "NONE" : "FULL";
  let infraLevel = "PARTIAL";
  let infraNote = "Couverture voirie mondiale OSM active.";
  if (params.osmZoomDeferred) {
    infraLevel = "PARTIAL";
    infraNote = `Vue macro (Zoom ${params.zoom}) \u2014 zoomez (\u2265 10) pour inspecter la voirie locale OSM.`;
  } else if (params.osmMode === "unavailable") {
    infraLevel = "NONE";
    infraNote = "Miroirs Overpass OSM temporairement injoignables.";
  } else if (params.osmMappedWayCount === 0) {
    infraLevel = "NONE";
    infraNote = "Aucune route ou infrastructure cartographi\xE9e sur OSM dans ce secteur (oc\xE9an ou zone non cartographi\xE9e).";
  } else {
    infraLevel = "FULL";
    infraNote = `${params.osmMappedWayCount} axes/infrastructures routi\xE8res OSM v\xE9rifi\xE9s.`;
  }
  let trafficLevel = "PARTIAL";
  let trafficNote = "";
  if (params.trafficHasRegionalFeed) {
    trafficLevel = "FULL";
    trafficNote = `Flux trafic ouvert r\xE9gional actif (${regionalTrafficProviders.join(", ")} + OSM).`;
  } else if (params.zoom < 10) {
    trafficLevel = "NONE";
    trafficNote = "Aucun flux congestion temps r\xE9el mondial \xE0 cette \xE9chelle sans portail municipal d\xE9di\xE9.";
  } else if (params.osmMappedWayCount === 0 && params.osmMode !== "unavailable") {
    trafficLevel = "NONE";
    trafficNote = "R\xE9seau routier absent dans l\u2019emprise s\xE9lectionn\xE9e.";
  } else {
    trafficLevel = "PARTIAL";
    trafficNote = "Travaux/fermetures OSM & communaut\xE9 VRU actifs \u2014 aucun portail municipal de congestion en direct dans ce pays.";
  }
  const incidentLevel = params.vruInBoundsCount > 0 ? "FULL" : "PARTIAL";
  const incidentNote = params.vruInBoundsCount > 0 ? `${params.vruInBoundsCount} signalement(s) VRU Guard actifs dans la zone.` : "R\xE9seau communautaire mondial pr\xEAt \u2014 aucun signalement VRU d\xE9pos\xE9 dans cette emprise.";
  const byCategory = [
    {
      category: "WEATHER",
      label: "Conditions M\xE9t\xE9o",
      level: weatherLevel,
      providers: [
        params.meteoFallback || "Open-Meteo Global",
        "MET Norway Fallback"
      ],
      note: weatherLevel === "FULL" ? `Couverture mondiale active (${params.meteoFallback || "Open-Meteo"}).` : "M\xE9t\xE9o mondiale momentan\xE9ment indisponible."
    },
    {
      category: "EXTERNAL_ALERT",
      label: "Alertes Officielles",
      level: officialLevel,
      providers: params.officialProviders.length ? params.officialProviders : ["GDACS", "USGS", "NASA EONET"],
      note: officialLevel === "FULL" ? "Catastrophes naturelles, s\xE9ismes et alertes WMO mondiales actifs." : "Flux alertes mondiales indisponible."
    },
    {
      category: "INFRASTRUCTURE",
      label: "Infrastructures & Voirie",
      level: infraLevel,
      providers: [params.osmFallback || "OpenStreetMap Overpass"],
      note: infraNote
    },
    {
      category: "TRAFFIC",
      label: "Trafic & Travaux",
      level: trafficLevel,
      providers: params.trafficProviders.length ? params.trafficProviders : ["OSM Traffic", "Portails Open Data"],
      note: trafficNote
    },
    {
      category: "INCIDENT",
      label: "Incidents VRU Guard",
      level: incidentLevel,
      providers: ["VRU Guard Sentinel"],
      note: incidentNote
    }
  ];
  const hasLocalStreetCoverage = !params.osmZoomDeferred && params.osmMappedWayCount > 0;
  let overallStatus = "PARTIAL";
  if (weatherLevel === "NONE" && officialLevel === "NONE" && infraLevel === "NONE") {
    overallStatus = "NONE";
  } else if (weatherLevel === "FULL" && officialLevel === "FULL" && infraLevel === "FULL" && trafficLevel === "FULL") {
    overallStatus = "FULL";
  } else if (!hasLocalStreetCoverage && params.zoom >= 10 && params.cellsCount === 0) {
    overallStatus = params.osmMode === "unavailable" ? "NONE" : "PARTIAL";
  }
  let insufficientDataReason = null;
  if (params.osmMappedWayCount === 0 && !params.osmZoomDeferred && params.osmMode !== "unavailable") {
    insufficientDataReason = "Zone sans r\xE9seau routier OSM cartographi\xE9 : l'absence d'incident ne signifie pas que l'endroit est s\xFBr.";
  } else if (params.cellsCount === 0 && !params.trafficHasRegionalFeed) {
    insufficientDataReason = "Aucun portail de trafic municipal temps r\xE9el ni signalement local VRU dans ce secteur. L'absence de donn\xE9es ne garantit pas une zone s\xFBre.";
  } else if (params.osmZoomDeferred && params.cellsCount === 0) {
    insufficientDataReason = "\xC9chelle continentale/mondiale : zoomez au niveau urbain pour inspecter le d\xE9tail voirie et local.";
  }
  const knownRegionalFeeds = [
    {
      id: "open_meteo",
      name: "Open-Meteo + Failover MET Norway 2.0",
      scope: "GLOBAL",
      regionLabel: "Monde entier (Terre & Oc\xE9ans)",
      categories: ["WEATHER", "EXTERNAL_ALERT"],
      refreshCadenceLabel: "Auto \xB7 10 min",
      activeInViewport: weatherLevel === "FULL",
      failoverCapable: true,
      statusNote: params.meteoFallback ? `Failover actif : ${params.meteoFallback}` : "Source primaire active"
    },
    {
      id: "global_hazards",
      name: "GDACS + USGS + NASA EONET v3",
      scope: "GLOBAL",
      regionLabel: "Monde entier (Catastrophes & S\xE9ismes)",
      categories: ["EXTERNAL_ALERT"],
      refreshCadenceLabel: "Auto \xB7 15 min",
      activeInViewport: officialLevel === "FULL",
      failoverCapable: true,
      statusNote: params.officialProviders.length ? `${params.officialProviders.join(" + ")}` : "Indisponible"
    },
    {
      id: "osm_overpass",
      name: "OpenStreetMap Overpass Multi-Miroirs",
      scope: "GLOBAL",
      regionLabel: "Monde entier (Zoom \u2265 10)",
      categories: ["INFRASTRUCTURE", "TRAFFIC"],
      refreshCadenceLabel: "Auto \xB7 20 min",
      activeInViewport: infraLevel === "FULL",
      failoverCapable: true,
      statusNote: params.osmZoomDeferred ? "En attente de zoom ville (\u2265 10)" : params.osmFallback ? `Miroir actif : ${params.osmFallback}` : `${params.osmMappedWayCount} axes index\xE9s`
    },
    {
      id: "paris_opendata",
      name: "Paris Open Data (Chantiers Perturbants)",
      scope: "REGIONAL",
      regionLabel: "France \xB7 Paris / \xCEle-de-France",
      categories: ["TRAFFIC"],
      refreshCadenceLabel: "Auto \xB7 10 min",
      activeInViewport: cap.touchesParisIdf,
      failoverCapable: false,
      statusNote: cap.touchesParisIdf ? "Actif dans la vue" : "Hors emprise actuelle"
    },
    {
      id: "tfl_london",
      name: "Transport for London (TfL Road API)",
      scope: "REGIONAL",
      regionLabel: "Royaume-Uni \xB7 Grand Londres",
      categories: ["TRAFFIC"],
      refreshCadenceLabel: "Auto \xB7 8 min",
      activeInViewport: cap.touchesLondonUk,
      failoverCapable: false,
      statusNote: cap.touchesLondonUk ? "Actif dans la vue" : "Hors emprise actuelle"
    },
    {
      id: "fintraffic_fi",
      name: "Fintraffic Digitraffic (Finlande)",
      scope: "REGIONAL",
      regionLabel: "Europe du Nord \xB7 Finlande nationale",
      categories: ["TRAFFIC"],
      refreshCadenceLabel: "Auto \xB7 10 min",
      activeInViewport: cap.touchesFinland,
      failoverCapable: false,
      statusNote: cap.touchesFinland ? "Actif dans la vue" : "Hors emprise actuelle"
    },
    {
      id: "noaa_nws_us",
      name: "NOAA National Weather Service Alerts",
      scope: "REGIONAL",
      regionLabel: "Am\xE9rique du Nord \xB7 \xC9tats-Unis",
      categories: ["EXTERNAL_ALERT", "TRAFFIC"],
      refreshCadenceLabel: "Auto \xB7 8 min",
      activeInViewport: cap.touchesUsLower48 && !cap.spansWholeWorld,
      failoverCapable: false,
      statusNote: cap.touchesUsLower48 && !cap.spansWholeWorld ? "Actif dans la vue" : "Hors emprise actuelle"
    }
  ];
  const summaryNote = overallStatus === "FULL" ? `Couverture compl\xE8te multi-fournisseurs v\xE9rifi\xE9e sur ${cap.regionLabel}.` : overallStatus === "NONE" ? `Donn\xE9es indisponibles sur ${cap.regionLabel} \u2014 ne pas interpr\xE9ter comme une zone s\xFBre.` : `Couverture partielle sur ${cap.regionLabel} : m\xE9t\xE9o & alertes mondiales actives, flux trafic local limit\xE9 aux sources ouvertes disponibles.`;
  return {
    overallStatus,
    regionLabel: cap.regionLabel,
    summaryNote,
    insufficientDataReason,
    hasLocalStreetCoverage,
    hasRegionalLiveTraffic: params.trafficHasRegionalFeed,
    byCategory,
    knownRegionalFeeds
  };
}
async function queryHeatmap(req, firestoreFetcher) {
  const now = Date.now();
  const zoom = Number(req.zoom) || 13;
  const categories = req.categories?.length ? req.categories : ALL_CATEGORIES2;
  const severities = req.severities?.length ? req.severities : ALL_SEVERITIES2;
  const sources = req.sources?.length ? req.sources : ALL_SOURCES2;
  const { startAt, endAt, isHistorical } = resolveTimeWindow(
    req.period,
    req.customStartAt,
    req.customEndAt,
    now
  );
  let effectiveBounds = req.bounds;
  const zoneCenter = req.zoneFilter?.center;
  const zoneRadius = req.zoneFilter?.radiusMeters || 3e3;
  if ((req.zoneFilter?.mode === "radius" || req.zoneFilter?.mode === "search") && zoneCenter) {
    const dLat = zoneRadius / 111320;
    const dLng = zoneRadius / (111320 * Math.max(0.2, Math.cos(zoneCenter.lat * Math.PI / 180)));
    effectiveBounds = {
      northEast: {
        lat: Math.max(req.bounds.northEast.lat, zoneCenter.lat + dLat),
        lng: Math.max(req.bounds.northEast.lng, zoneCenter.lng + dLng)
      },
      southWest: {
        lat: Math.min(req.bounds.southWest.lat, zoneCenter.lat - dLat),
        lng: Math.min(req.bounds.southWest.lng, zoneCenter.lng - dLng)
      }
    };
  }
  const [vruRes, meteoRes, osmRes, trafficRes, officialRes] = await Promise.all([
    sources.includes("VRUGUARD_USER") ? fetchVruGuardSource(firestoreFetcher, effectiveBounds) : Promise.resolve({
      events: [],
      inBoundsCount: 0,
      mode: "cached",
      detail: "Source d\xE9sactiv\xE9e par filtre"
    }),
    sources.includes("OPEN_METEO") ? fetchOpenMeteoSource(effectiveBounds, startAt, endAt, isHistorical) : Promise.resolve({
      events: [],
      summary: null,
      mode: "cached",
      fallbackUsed: null,
      detail: "Source d\xE9sactiv\xE9e par filtre"
    }),
    sources.includes("OPENSTREETMAP") ? fetchOpenStreetMapSource(effectiveBounds, zoom) : Promise.resolve({
      events: [],
      mode: "cached",
      mappedWayCount: 0,
      zoomDeferred: true,
      fallbackUsed: null,
      detail: "Source d\xE9sactiv\xE9e par filtre"
    }),
    sources.includes("TRAFFIC_API") ? fetchTrafficApiSource(effectiveBounds, zoom) : Promise.resolve({
      events: [],
      configured: true,
      mode: "cached",
      activeProviders: [],
      hasRegionalLiveFeed: false,
      fallbackUsed: null,
      detail: "Source d\xE9sactiv\xE9e par filtre"
    }),
    sources.includes("OFFICIAL_ALERT") ? fetchOfficialExternalAlertsSource(effectiveBounds) : Promise.resolve({
      events: [],
      mode: "cached",
      activeProviders: [],
      fallbackUsed: null,
      detail: "Source d\xE9sactiv\xE9e par filtre"
    })
  ]);
  let matchingEvents = heatmapStore.queryEvents({
    minLat: effectiveBounds.southWest.lat,
    maxLat: effectiveBounds.northEast.lat,
    minLng: effectiveBounds.southWest.lng,
    maxLng: effectiveBounds.northEast.lng,
    startAt,
    endAt,
    includeExpired: isHistorical,
    categories,
    severities,
    sources
  });
  if (zoneCenter && (req.zoneFilter?.mode === "radius" || req.zoneFilter?.mode === "search")) {
    matchingEvents = matchingEvents.filter(
      (ev) => haversineMeters(zoneCenter, { lat: ev.lat, lng: ev.lng }) <= zoneRadius
    );
  }
  const cells = clusterEventsIntoCells(
    matchingEvents,
    zoom,
    endAt,
    isHistorical
  );
  let comparison = null;
  const cmpWin = resolveComparisonWindow(
    req.compareOffset,
    startAt,
    endAt,
    req.compareStartAt,
    req.compareEndAt
  );
  if (cmpWin) {
    let pastEvents = heatmapStore.queryEvents({
      minLat: effectiveBounds.southWest.lat,
      maxLat: effectiveBounds.northEast.lat,
      minLng: effectiveBounds.southWest.lng,
      maxLng: effectiveBounds.northEast.lng,
      startAt: cmpWin.startAt,
      endAt: cmpWin.endAt,
      includeExpired: true,
      categories,
      severities,
      sources
    });
    if (zoneCenter && (req.zoneFilter?.mode === "radius" || req.zoneFilter?.mode === "search")) {
      pastEvents = pastEvents.filter(
        (ev) => haversineMeters(zoneCenter, { lat: ev.lat, lng: ev.lng }) <= zoneRadius
      );
    }
    const pastCells = clusterEventsIntoCells(
      pastEvents,
      zoom,
      cmpWin.endAt,
      true
    );
    const pastMap = new Map(pastCells.map((c) => [c.cellId, c]));
    let aggravated = 0;
    let improved = 0;
    let stable = 0;
    cells.forEach((cell) => {
      const prev = pastMap.get(cell.cellId);
      const prevScore = prev ? prev.riskScore : 0;
      const delta = cell.riskScore - prevScore;
      cell.previousRiskScore = prevScore;
      cell.deltaScore = delta;
      if (delta >= 8) aggravated++;
      else if (delta <= -8) improved++;
      else stable++;
    });
    const curAvg = cells.length > 0 ? Math.round(cells.reduce((acc, c) => acc + c.riskScore, 0) / cells.length) : 0;
    const prevAvg = pastCells.length > 0 ? Math.round(
      pastCells.reduce((acc, c) => acc + c.riskScore, 0) / pastCells.length
    ) : 0;
    comparison = {
      enabled: true,
      referenceLabel: cmpWin.label,
      referenceStartAt: cmpWin.startAt,
      referenceEndAt: cmpWin.endAt,
      currentAvgRisk: curAvg,
      previousAvgRisk: prevAvg,
      deltaAvgRisk: curAvg - prevAvg,
      aggravatedZones: aggravated,
      improvedZones: improved,
      stableZones: stable,
      currentCriticalCells: cells.filter((c) => c.riskLevel === "CRITICAL").length,
      previousCriticalCells: pastCells.filter((c) => c.riskLevel === "CRITICAL").length
    };
  }
  const heatPoints = cells.map((c) => [
    c.center.lat,
    c.center.lng,
    c.heatIntensity
  ]);
  const dedupedAll = deduplicateHeatmapEvents(matchingEvents);
  const rawConfirmationsCount = dedupedAll.reduce(
    (acc, e) => acc + e.confirmations,
    0
  );
  const criticalCells = cells.filter((c) => c.riskLevel === "CRITICAL").length;
  const highCells = cells.filter((c) => c.riskLevel === "HIGH").length;
  const moderateCells = cells.filter((c) => c.riskLevel === "MODERATE").length;
  const lowCells = cells.filter((c) => c.riskLevel === "LOW").length;
  const coverage = evaluateRegionCoverage({
    bounds: effectiveBounds,
    zoom,
    vruInBoundsCount: vruRes.inBoundsCount,
    meteoMode: meteoRes.mode,
    meteoFallback: meteoRes.fallbackUsed,
    osmMode: osmRes.mode,
    osmMappedWayCount: osmRes.mappedWayCount,
    osmZoomDeferred: osmRes.zoomDeferred,
    osmFallback: osmRes.fallbackUsed,
    trafficHasRegionalFeed: trafficRes.hasRegionalLiveFeed,
    trafficProviders: trafficRes.activeProviders,
    officialMode: officialRes.mode,
    officialProviders: officialRes.activeProviders,
    cellsCount: cells.length
  });
  const hasFullLocalVerification = !osmRes.zoomDeferred && osmRes.mappedWayCount > 0 && meteoRes.mode !== "unavailable" && trafficRes.hasRegionalLiveFeed;
  const insufficientData = cells.length === 0 && !hasFullLocalVerification;
  const topSlice = cells.slice(0, Math.max(1, Math.min(10, cells.length)));
  const computedScore = topSlice.length > 0 ? Math.round(
    topSlice[0].riskScore * 0.45 + topSlice.reduce((a, b) => a + b.riskScore, 0) / topSlice.length * 0.55
  ) : 0;
  const regionRiskIndex = insufficientData ? null : computedScore;
  const regionRiskLevel = insufficientData ? "UNKNOWN" : riskLevelFromScore(computedScore);
  if (cells.length > 0) {
    const centerGh = import_ngeohash2.default.encode(
      (effectiveBounds.northEast.lat + effectiveBounds.southWest.lat) / 2,
      (effectiveBounds.northEast.lng + effectiveBounds.southWest.lng) / 2,
      6
    );
    heatmapStore.recordSnapshot(centerGh, cells.length, computedScore);
  }
  const countBySource = (src) => dedupedAll.filter((e) => e.source === src).length;
  const sourceStatuses = [
    {
      source: "VRUGUARD_USER",
      label: "VRU Guard Sentinel",
      active: sources.includes("VRUGUARD_USER"),
      configured: true,
      eventCount: countBySource("VRUGUARD_USER"),
      mode: vruRes.mode,
      detail: vruRes.detail,
      lastSyncAt: now,
      coverageScope: "GLOBAL",
      coverageLevel: vruRes.inBoundsCount > 0 ? "FULL" : "PARTIAL",
      fallbackUsed: null,
      refreshCadenceLabel: "Temps r\xE9el (2 min)",
      nextSyncAt: now + 2 * 60 * 1e3
    },
    {
      source: "TRAFFIC_API",
      label: "Trafic Open Data Multi-Pays",
      active: sources.includes("TRAFFIC_API"),
      configured: trafficRes.configured,
      eventCount: countBySource("TRAFFIC_API"),
      mode: trafficRes.mode,
      detail: trafficRes.detail,
      lastSyncAt: now,
      coverageScope: trafficRes.hasRegionalLiveFeed ? "REGIONAL" : "GLOBAL",
      coverageLevel: coverage.byCategory.find((c) => c.category === "TRAFFIC")?.level || "PARTIAL",
      fallbackUsed: trafficRes.fallbackUsed,
      refreshCadenceLabel: "Auto \xB7 8\u201310 min",
      nextSyncAt: now + 8 * 60 * 1e3
    },
    {
      source: "OPEN_METEO",
      label: "M\xE9t\xE9o Mondiale (Open-Meteo)",
      active: sources.includes("OPEN_METEO"),
      configured: true,
      eventCount: countBySource("OPEN_METEO"),
      mode: meteoRes.mode,
      detail: meteoRes.detail,
      lastSyncAt: now,
      coverageScope: "GLOBAL",
      coverageLevel: meteoRes.mode === "unavailable" ? "NONE" : "FULL",
      fallbackUsed: meteoRes.fallbackUsed,
      refreshCadenceLabel: "Auto \xB7 10 min",
      nextSyncAt: now + 10 * 60 * 1e3
    },
    {
      source: "OPENSTREETMAP",
      label: "OpenStreetMap Voirie",
      active: sources.includes("OPENSTREETMAP"),
      configured: true,
      eventCount: countBySource("OPENSTREETMAP"),
      mode: osmRes.mode,
      detail: osmRes.detail,
      lastSyncAt: now,
      coverageScope: "GLOBAL",
      coverageLevel: coverage.byCategory.find((c) => c.category === "INFRASTRUCTURE")?.level || "PARTIAL",
      fallbackUsed: osmRes.fallbackUsed,
      refreshCadenceLabel: "Auto \xB7 20 min",
      nextSyncAt: now + 20 * 60 * 1e3
    },
    {
      source: "OFFICIAL_ALERT",
      label: "Alertes Mondiales (GDACS/USGS/NASA)",
      active: sources.includes("OFFICIAL_ALERT"),
      configured: true,
      eventCount: countBySource("OFFICIAL_ALERT"),
      mode: officialRes.mode,
      detail: officialRes.detail,
      lastSyncAt: now,
      coverageScope: "GLOBAL",
      coverageLevel: officialRes.mode === "unavailable" ? "NONE" : "FULL",
      fallbackUsed: officialRes.fallbackUsed,
      refreshCadenceLabel: "Auto \xB7 15 min",
      nextSyncAt: now + 15 * 60 * 1e3
    }
  ];
  return {
    generatedAt: now,
    periodStartAt: startAt,
    periodEndAt: endAt,
    isHistorical,
    heatPoints,
    cells,
    weatherSummary: meteoRes.summary,
    sourceStatuses,
    coverage,
    stats: {
      regionRiskIndex,
      regionRiskLevel,
      insufficientData,
      totalCells: cells.length,
      criticalCells,
      highCells,
      moderateCells,
      lowCells,
      dedupEventsCount: dedupedAll.length,
      rawConfirmationsCount
    },
    comparison
  };
}
async function inspectHeatmapZone(req) {
  const now = Date.now();
  const radiusMeters = Math.max(150, Math.min(1e4, req.radiusMeters || 450));
  const zoom = Number(req.zoom) || 13;
  const categories = req.categories?.length ? req.categories : ALL_CATEGORIES2;
  const severities = req.severities?.length ? req.severities : ALL_SEVERITIES2;
  const sources = req.sources?.length ? req.sources : ALL_SOURCES2;
  const { startAt, endAt, isHistorical } = resolveTimeWindow(
    req.period,
    req.customStartAt,
    req.customEndAt,
    now
  );
  const dLat = radiusMeters / 111320;
  const dLng = radiusMeters / (111320 * Math.max(0.2, Math.cos(req.lat * Math.PI / 180)));
  const bounds = {
    northEast: { lat: req.lat + dLat, lng: req.lng + dLng },
    southWest: { lat: req.lat - dLat, lng: req.lng - dLng }
  };
  const [meteoRes, osmRoadCheck] = await Promise.all([
    sources.includes("OPEN_METEO") ? fetchOpenMeteoSource(bounds, startAt, endAt, isHistorical) : Promise.resolve({
      events: [],
      summary: null,
      mode: "cached",
      fallbackUsed: null,
      detail: ""
    }),
    sources.includes("OPENSTREETMAP") && zoom >= 10 ? ensureOsmRoadBaselineForPoint(req.lat, req.lng) : Promise.resolve({ known: false, roadCount: 0 })
  ]);
  const candidates = heatmapStore.queryEvents({
    minLat: bounds.southWest.lat,
    maxLat: bounds.northEast.lat,
    minLng: bounds.southWest.lng,
    maxLng: bounds.northEast.lng,
    startAt,
    endAt,
    includeExpired: isHistorical,
    categories,
    severities,
    sources
  }).filter(
    (ev) => haversineMeters({ lat: req.lat, lng: req.lng }, { lat: ev.lat, lng: ev.lng }) <= radiusMeters
  );
  const summary = computeRiskSummaryForEvents(candidates, endAt, isHistorical);
  const eventsSorted = [...summary.dedupEvents].sort(
    (a, b) => b.severityScore - a.severityScore || b.lastUpdatedAt - a.lastUpdatedAt
  );
  const cap = detectRegionalCapabilities(bounds);
  const hasRegionalLiveFeed = cap.touchesParisIdf || cap.touchesLondonUk || cap.touchesFinland || cap.touchesUsLower48;
  const hasVerifiedLocalSurface = osmRoadCheck.known && osmRoadCheck.roadCount > 0 && meteoRes.mode !== "unavailable";
  const hasSufficientData = eventsSorted.length > 0 || hasVerifiedLocalSurface && hasRegionalLiveFeed;
  const coverageStatus = !osmRoadCheck.known || osmRoadCheck.roadCount === 0 ? "NONE" : hasRegionalLiveFeed ? "FULL" : "PARTIAL";
  const finalRiskScore = hasSufficientData ? summary.riskScore : null;
  const finalRiskLevel = hasSufficientData ? summary.riskLevel : "UNKNOWN";
  let coverageNote = "";
  let unknownSafeWarning = null;
  if (coverageStatus === "NONE") {
    coverageNote = "Aucune route OSM ni capteur local d\xE9tect\xE9 dans ce rayon (ex: oc\xE9an, zone rurale isol\xE9e ou \xE9chelle trop large).";
  } else if (coverageStatus === "PARTIAL") {
    coverageNote = `Couverture partielle (${cap.regionLabel}) : m\xE9t\xE9o et voirie OSM disponibles, mais aucun flux trafic municipal temps r\xE9el.`;
  } else {
    coverageNote = `Couverture compl\xE8te multi-sources active sur ${cap.regionLabel}.`;
  }
  let densityVsDangerNote = "";
  if (!hasSufficientData) {
    unknownSafeWarning = "Donn\xE9es locales insuffisantes : l'absence de signalement ici ne signifie pas que la zone est s\xFBre.";
    densityVsDangerNote = "Indice non affirm\xE9 (Donn\xE9es insuffisantes) \u2014 seuls la m\xE9t\xE9o macro ou la voirie statique sont disponibles sans retour d'incident local.";
  } else if (eventsSorted.length === 0) {
    densityVsDangerNote = "Secteur v\xE9rifi\xE9 (voirie OSM, m\xE9t\xE9o & portail trafic local actifs) : aucun incident ni perturbation d\xE9tect\xE9.";
  } else if (summary.riskScore >= 75 && eventsSorted.length <= 3) {
    densityVsDangerNote = `Indice \xE9lev\xE9 (${summary.riskScore}/100) malgr\xE9 ${summary.rawConfirmations} \xE9v\xE9nement(s) : gravit\xE9 intrins\xE8que critique d\xE9tect\xE9e.`;
  } else if (summary.rawConfirmations >= 6 && summary.riskScore < 50) {
    densityVsDangerNote = `${summary.rawConfirmations} signalement(s) mineurs d\xE9dupliqu\xE9s \u2014 l\u2019indice r\xE9el reste mod\xE9r\xE9 (${summary.riskScore}/100) car la gravit\xE9 unitaire est faible.`;
  } else {
    densityVsDangerNote = `Indice calcul\xE9 (${summary.riskScore}/100) pond\xE9rant gravit\xE9, fiabilit\xE9 et synergie sur ${eventsSorted.length} al\xE9a(s) distinct(s) (${summary.rawConfirmations} confirmations).`;
  }
  const categoryScores = Object.keys(summary.categoryBreakdown).map((cat) => ({
    category: cat,
    maxSeverity: Math.round(summary.categoryMaxSeverity[cat] || 0),
    count: summary.categoryBreakdown[cat] || 0
  })).sort((a, b) => b.maxSeverity - a.maxSeverity);
  const collectedAt = eventsSorted.length > 0 ? Math.min(...eventsSorted.map((e) => e.collectedAt)) : null;
  const lastUpdatedAt = eventsSorted.length > 0 ? Math.max(...eventsSorted.map((e) => e.lastUpdatedAt)) : null;
  let comparison = null;
  const cmpWin = resolveComparisonWindow(
    req.compareOffset,
    startAt,
    endAt,
    req.compareStartAt,
    req.compareEndAt
  );
  if (cmpWin) {
    const pastEvents = heatmapStore.queryEvents({
      minLat: bounds.southWest.lat,
      maxLat: bounds.northEast.lat,
      minLng: bounds.southWest.lng,
      maxLng: bounds.northEast.lng,
      startAt: cmpWin.startAt,
      endAt: cmpWin.endAt,
      includeExpired: true,
      categories,
      severities,
      sources
    }).filter(
      (ev) => haversineMeters(
        { lat: req.lat, lng: req.lng },
        { lat: ev.lat, lng: ev.lng }
      ) <= radiusMeters
    );
    const pastSummary = computeRiskSummaryForEvents(
      pastEvents,
      cmpWin.endAt,
      true
    );
    const prevAvailable = pastSummary.dedupEvents.length > 0 || hasVerifiedLocalSurface;
    if (finalRiskScore === null || !prevAvailable) {
      comparison = {
        previousRiskScore: prevAvailable ? pastSummary.riskScore : null,
        previousRiskLevel: prevAvailable ? pastSummary.riskLevel : "UNKNOWN",
        previousEventCount: pastSummary.dedupEvents.length,
        deltaScore: null,
        trend: "unknown",
        referenceLabel: cmpWin.label
      };
    } else {
      const delta = finalRiskScore - pastSummary.riskScore;
      comparison = {
        previousRiskScore: pastSummary.riskScore,
        previousRiskLevel: pastSummary.riskLevel,
        previousEventCount: pastSummary.dedupEvents.length,
        deltaScore: delta,
        trend: delta >= 8 ? "aggravated" : delta <= -8 ? "improved" : "stable",
        referenceLabel: cmpWin.label
      };
    }
  }
  return {
    center: { lat: req.lat, lng: req.lng },
    radiusMeters,
    cellId: import_ngeohash2.default.encode(req.lat, req.lng, 7),
    riskScore: finalRiskScore,
    riskLevel: finalRiskLevel,
    coverageStatus,
    hasSufficientData,
    coverageNote,
    unknownSafeWarning,
    rawEventCount: summary.rawConfirmations,
    dedupEventCount: eventsSorted.length,
    densityVsDangerNote,
    synergyBonus: summary.synergyBonus,
    categoryScores,
    weather: meteoRes.summary,
    events: eventsSorted.slice(0, 40),
    sources: Array.from(new Set(eventsSorted.map((e) => e.source))),
    collectedAt,
    lastUpdatedAt,
    comparison
  };
}

// server.ts
function loadFirebaseConfig() {
  try {
    const cfgPath = import_path4.default.join(process.cwd(), "firebase-applet-config.json");
    return JSON.parse(import_fs4.default.readFileSync(cfgPath, "utf8"));
  } catch {
    return { projectId: process.env.FIREBASE_PROJECT_ID || "gen-lang-client-0061104847" };
  }
}
var firebaseConfig = loadFirebaseConfig();
var adminFirestore = null;
var hasAdminIam = false;
if (!(0, import_app.getApps)().length) {
  const saRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (saRaw) {
    try {
      const sa = JSON.parse(saRaw);
      const appInstance = (0, import_app.initializeApp)({
        credential: (0, import_app.cert)(sa),
        projectId: firebaseConfig.projectId
      });
      adminFirestore = firebaseConfig.firestoreDatabaseId ? (0, import_firestore.getFirestore)(appInstance, firebaseConfig.firestoreDatabaseId) : (0, import_firestore.getFirestore)(appInstance);
      hasAdminIam = true;
    } catch (e) {
      console.warn("Invalid FIREBASE_SERVICE_ACCOUNT_KEY, initializing token-only verifier:", e);
      (0, import_app.initializeApp)({ projectId: firebaseConfig.projectId });
    }
  } else {
    (0, import_app.initializeApp)({ projectId: firebaseConfig.projectId });
  }
}
var rateBuckets = /* @__PURE__ */ new Map();
function checkRateLimit(key, maxRequests, windowMs) {
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
function getClientIp(req) {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.trim()) {
    return fwd.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}
function isPrivateOrLocalIp(ip) {
  const clean = ip.replace(/^::ffff:/i, "").trim().toLowerCase();
  if (!clean || clean === "unknown" || clean === "::1" || clean === "localhost") return true;
  if (clean.startsWith("127.") || clean.startsWith("10.") || clean.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(clean)) return true;
  if (clean.startsWith("fc") || clean.startsWith("fd") || clean.startsWith("fe80:")) return true;
  return false;
}
var geoIpCache = /* @__PURE__ */ new Map();
async function resolveVisitorGeo(req) {
  const headerKeys = [
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-appengine-country",
    "cloudfront-viewer-country",
    "x-country-code"
  ];
  for (const key of headerKeys) {
    const raw = req.headers[key];
    const code = typeof raw === "string" ? raw.trim().toUpperCase() : "";
    if (/^[A-Z]{2}$/.test(code) && code !== "XX" && code !== "ZZ" && code !== "T1") {
      return {
        country: code,
        currency: getCurrencyForCountry(code),
        source: "header"
      };
    }
  }
  const rawIp = getClientIp(req).replace(/^::ffff:/i, "").trim();
  if (isPrivateOrLocalIp(rawIp)) {
    return {
      country: null,
      currency: "EUR",
      source: "fallback"
    };
  }
  const cached = geoIpCache.get(rawIp);
  if (cached && cached.expiresAt > Date.now()) {
    return {
      country: cached.country,
      currency: getCurrencyForCountry(cached.country),
      source: cached.country ? "geoip" : "fallback"
    };
  }
  let detectedCountry = null;
  try {
    const resp = await fetch(`https://ipapi.co/${encodeURIComponent(rawIp)}/country/`, {
      signal: AbortSignal.timeout(1800),
      headers: { Accept: "text/plain" }
    });
    if (resp.ok) {
      const txt = (await resp.text()).trim().toUpperCase();
      if (/^[A-Z]{2}$/.test(txt)) {
        detectedCountry = txt;
      }
    }
  } catch {
    try {
      const resp2 = await fetch(
        `http://ip-api.com/json/${encodeURIComponent(rawIp)}?fields=status,countryCode`,
        { signal: AbortSignal.timeout(1800) }
      );
      if (resp2.ok) {
        const data = await resp2.json();
        if (data.status === "success" && data.countryCode && /^[A-Z]{2}$/.test(data.countryCode)) {
          detectedCountry = data.countryCode.toUpperCase();
        }
      }
    } catch {
    }
  }
  geoIpCache.set(rawIp, {
    country: detectedCountry,
    expiresAt: Date.now() + 6 * 60 * 60 * 1e3
  });
  return {
    country: detectedCountry,
    currency: getCurrencyForCountry(detectedCountry),
    source: detectedCountry ? "geoip" : "fallback"
  };
}
function decodeFirestoreValue(val) {
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
    const out = {};
    const fields = val.mapValue?.fields || {};
    Object.entries(fields).forEach(([k, v]) => {
      out[k] = decodeFirestoreValue(v);
    });
    return out;
  }
  return val;
}
function decodeFirestoreDocument(docItem) {
  const name = docItem?.name || "";
  const id = name.split("/").pop() || "";
  const fields = docItem?.fields || {};
  const obj = { id };
  Object.entries(fields).forEach(([k, v]) => {
    obj[k] = decodeFirestoreValue(v);
  });
  return obj;
}
async function fetchFirestoreCollectionWithToken(collectionName, idToken) {
  if (adminFirestore) {
    try {
      const snap = await adminFirestore.collection(collectionName).limit(500).get();
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } catch {
    }
  }
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(
      dbId
    )}/documents/${encodeURIComponent(collectionName)}?pageSize=300`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const docs = Array.isArray(data?.documents) ? data.documents : [];
    return docs.map(decodeFirestoreDocument);
  } catch {
    return [];
  }
}
async function fetchMergedUsersFromFirestore(idToken) {
  const [fsUsers, fsProfiles] = await Promise.all([
    fetchFirestoreCollectionWithToken("users", idToken),
    fetchFirestoreCollectionWithToken("public_profiles", idToken)
  ]);
  const profileMap = /* @__PURE__ */ new Map();
  fsProfiles.forEach((p) => {
    const uid = p.uid || p.id;
    if (uid) profileMap.set(uid, p);
  });
  const mergedByUid = /* @__PURE__ */ new Map();
  fsUsers.forEach((u) => {
    const uid = u.uid || u.id;
    if (!uid || mergedByUid.has(uid)) return;
    const prof = profileMap.get(uid);
    const createdAt = typeof u.createdAt === "number" ? u.createdAt : u.createdAt?.toMillis?.() || null;
    const lastActiveAt = typeof prof?.lastActiveAt === "number" ? prof.lastActiveAt : prof?.lastActiveAt?.toMillis?.() || null;
    mergedByUid.set(uid, {
      uid,
      email: u.email || null,
      displayName: u.displayName || prof?.displayName || null,
      photoURL: u.photoURL || prof?.photoURL || null,
      createdAt,
      lastActiveAt
    });
  });
  return Array.from(mergedByUid.values());
}
var userCreatedAtCache = /* @__PURE__ */ new Map();
async function fetchUserCreatedAtMs(uid, idToken) {
  if (userCreatedAtCache.has(uid)) {
    return userCreatedAtCache.get(uid) ?? null;
  }
  try {
    const dbId = firebaseConfig.firestoreDatabaseId || "(default)";
    const url = `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${encodeURIComponent(
      dbId
    )}/documents/users/${uid}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${idToken}` }
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
async function mirrorSubscriptionToAdminFirestore(sub) {
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
        updatedAt: new Date(sub.updatedAt)
      },
      { merge: true }
    );
  } catch (err) {
    console.warn("Optional Admin Firestore mirror skipped:", err.message);
  }
}
async function mirrorAccessibilityToAdminFirestore(rec, documentBase64) {
  if (!adminFirestore || !rec?.id) return;
  try {
    let documentDataUrl = null;
    if (documentBase64 && typeof documentBase64 === "string") {
      const mime = rec.documentMimeType || "application/pdf";
      const candidate = documentBase64.startsWith("data:") ? documentBase64 : `data:${mime};base64,${documentBase64.replace(/^data:[^;]+;base64,/, "")}`;
      if (candidate.length <= 74e4) {
        documentDataUrl = candidate;
      }
    }
    const payload = {
      id: rec.id,
      uid: rec.uid,
      email: rec.email ?? null,
      displayName: rec.displayName ?? null,
      fullName: rec.fullName,
      disabilityCategory: rec.disabilityCategory,
      description: rec.description,
      documentName: rec.documentName || "justificatif",
      documentMimeType: rec.documentMimeType || "application/pdf",
      documentSize: rec.documentSize || 0,
      hasDocumentFile: Boolean(rec.hasDocumentFile || documentDataUrl),
      status: rec.status,
      adminComment: rec.adminComment ?? null,
      reviewedBy: rec.reviewedBy ?? null,
      reviewedAt: rec.reviewedAt ?? null,
      createdAt: rec.createdAt,
      updatedAt: rec.updatedAt,
      history: Array.isArray(rec.history) ? rec.history : []
    };
    if (documentDataUrl !== null) {
      payload.documentDataUrl = documentDataUrl;
    }
    await adminFirestore.collection("accessibility_requests").doc(rec.id).set(payload, { merge: true });
  } catch (err) {
    console.warn("Optional Accessibility Firestore mirror skipped:", err.message);
  }
}
async function hydrateAccessibilityFromAdminFirestore(uid) {
  if (!adminFirestore) return;
  try {
    const colRef = adminFirestore.collection("accessibility_requests");
    const snap = uid ? await colRef.where("uid", "==", uid).get() : await colRef.limit(200).get();
    snap.docs.forEach((d) => {
      const data = d.data();
      const { documentDataUrl: _omit, ...rest } = data;
      subscriptionStore.upsertExternalAccessibilityRequest({
        ...rest,
        id: rest.id || d.id,
        hasDocumentFile: Boolean(rest.hasDocumentFile || data.documentDataUrl),
        history: Array.isArray(rest.history) ? rest.history : []
      });
    });
  } catch (err) {
    console.warn("Optional Accessibility Firestore hydration skipped:", err.message);
  }
}
async function extractVerifiedToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const idToken = authHeader.slice("Bearer ".length).trim();
  if (!idToken) return null;
  const decoded = await (0, import_auth.getAuth)().verifyIdToken(idToken);
  return { decoded, idToken };
}
async function authenticateRequest(req, res, next) {
  try {
    const tokenResult = await extractVerifiedToken(req);
    if (!tokenResult) {
      return res.status(401).json({ error: "Authentification requise.", code: "UNAUTHENTICATED" });
    }
    const { decoded, idToken } = tokenResult;
    const authTimeMs = (decoded.auth_time || Math.floor(Date.now() / 1e3)) * 1e3;
    const email = decoded.email || null;
    const emailVerified = Boolean(decoded.email_verified);
    const createdAtMs = await fetchUserCreatedAtMs(decoded.uid, idToken);
    const dir = subscriptionStore.upsertDirectoryUser({
      uid: decoded.uid,
      email,
      displayName: decoded.name || null,
      photoURL: decoded.picture || null,
      emailVerified,
      createdAt: createdAtMs,
      lastLoginAt: Date.now()
    });
    if (dir.revokedAfter && authTimeMs < dir.revokedAfter) {
      return res.status(401).json({
        error: "Votre session a \xE9t\xE9 r\xE9voqu\xE9e par l\u2019administration. Veuillez vous reconnecter.",
        code: "SESSION_REVOKED"
      });
    }
    if (dir.accountStatus === "banned") {
      return res.status(403).json({
        error: dir.banReason ? `Ce compte a \xE9t\xE9 banni : ${dir.banReason}` : "Ce compte a \xE9t\xE9 banni d\xE9finitivement.",
        code: "ACCOUNT_BANNED"
      });
    }
    if (dir.accountStatus === "suspended") {
      return res.status(403).json({
        error: dir.suspensionReason ? `Ce compte est suspendu : ${dir.suspensionReason}` : "Ce compte est temporairement suspendu.",
        code: "ACCOUNT_SUSPENDED",
        suspensionExpiresAt: dir.suspensionExpiresAt
      });
    }
    if (dir.accountStatus === "soft_deleted") {
      return res.status(403).json({
        error: "Ce compte a \xE9t\xE9 d\xE9sactiv\xE9 / supprim\xE9.",
        code: "ACCOUNT_DELETED"
      });
    }
    req.authUser = {
      uid: decoded.uid,
      email,
      emailVerified,
      name: decoded.name || dir.displayName || null,
      picture: decoded.picture || dir.photoURL || null,
      authTimeMs,
      idToken,
      role: dir.role
    };
    req.userSubscription = subscriptionStore.getUserSubscription(decoded.uid, {
      email,
      userCreatedAtMs: createdAtMs
    });
    next();
  } catch (err) {
    console.warn("Token verification failed:", err.message);
    return res.status(401).json({ error: "Jeton d'authentification invalide.", code: "INVALID_TOKEN" });
  }
}
function requireSuperAdminPermission(permission, requireSuperOnly = false) {
  return (req, res, next) => {
    const authUser = req.authUser;
    const ip = getClientIp(req);
    if (!authUser) {
      return res.status(401).json({ error: "Authentification requise.", code: "UNAUTHENTICATED" });
    }
    const rateLimit = subscriptionStore.getPlatformSettings().securitySettings.adminRateLimitPerMin || 120;
    if (!checkRateLimit(`admin:${authUser.uid}:${ip}`, rateLimit, 6e4)) {
      subscriptionStore.recordAuditLog({
        adminUid: authUser.uid,
        adminEmail: authUser.email || authUser.uid,
        adminRole: authUser.role,
        action: "ADMIN_RATE_LIMITED",
        category: "security",
        outcome: "denied",
        ip,
        detail: `Rate limit d\xE9pass\xE9 sur ${req.method} ${req.originalUrl}`
      });
      return res.status(429).json({
        error: "Trop de requ\xEAtes administrateur. Patientez quelques secondes.",
        code: "RATE_LIMITED"
      });
    }
    const isAllowedRole = requireSuperOnly ? authUser.role === "SUPER_ADMIN" : authUser.role === "SUPER_ADMIN" || authUser.role === "ADMIN";
    const hasPerm = !permission || subscriptionStore.hasPermission(authUser.role, permission);
    if (!authUser.emailVerified || !isAllowedRole || !hasPerm) {
      subscriptionStore.recordAuditLog({
        adminUid: authUser.uid,
        adminEmail: authUser.email || authUser.uid,
        adminRole: authUser.role,
        action: "UNAUTHORIZED_ADMIN_ACCESS",
        category: "security",
        outcome: "denied",
        ip,
        detail: `Acc\xE8s refus\xE9 (403) sur ${req.method} ${req.originalUrl}`
      });
      return res.status(403).json({
        error: "Acc\xE8s refus\xE9 : droits Super Admin requis.",
        code: "FORBIDDEN_SUPER_ADMIN_REQUIRED"
      });
    }
    next();
  };
}
function requireRecentReauth(req, res, next) {
  const settings = subscriptionStore.getPlatformSettings();
  if (!settings.securitySettings.requireReauthForCriticalActions) {
    return next();
  }
  const authUser = req.authUser;
  if (!authUser) {
    return res.status(401).json({ error: "Authentification requise." });
  }
  const maxAgeMs = 30 * 60 * 1e3;
  const authAge = Date.now() - authUser.authTimeMs;
  if (authAge > maxAgeMs) {
    return res.status(403).json({
      error: "R\xE9-authentification requise pour cette action critique (session authentifi\xE9e depuis plus de 30 minutes).",
      code: "REAUTH_REQUIRED"
    });
  }
  next();
}
function requireFeature(feature) {
  return (req, res, next) => {
    const sub = req.userSubscription;
    if (!sub) {
      return res.status(401).json({ error: "Authentification requise.", code: "UNAUTHENTICATED" });
    }
    if (!hasFeatureAccess(sub, feature)) {
      const requiredPlan = getRequiredPlanForFeature(feature);
      const code = sub.status === "expired" ? "SUBSCRIPTION_EXPIRED" : sub.status === "suspended" ? "SUBSCRIPTION_SUSPENDED" : requiredPlan === "FAMILY" ? "FAMILY_REQUIRED" : requiredPlan === "BUSINESS" ? "BUSINESS_REQUIRED" : "PREMIUM_REQUIRED";
      return res.status(403).json({
        error: `Cette fonctionnalit\xE9 n\xE9cessite VruGuard ${requiredPlan}.`,
        code,
        requiredPlan,
        currentPlan: sub.effectivePlan,
        feature
      });
    }
    next();
  };
}
async function requireConsentAccepted(req, res, next) {
  if (!req.authUser) {
    return res.status(401).json({ error: "Authentification requise.", code: "UNAUTHENTICATED" });
  }
  let consent = subscriptionStore.getUserConsentStatus(req.authUser.uid);
  if (!consent.accessAllowed && adminFirestore) {
    try {
      const snap = await adminFirestore.collection("user_consents").doc(req.authUser.uid).get();
      if (snap.exists) {
        const fsData = snap.data();
        if (fsData && fsData.status === "accepted" && typeof fsData.acceptedAt === "number" && fsData.acceptedAt > 0) {
          const synced = subscriptionStore.acceptUserConsent({
            uid: req.authUser.uid,
            email: req.authUser.email || fsData.email || null,
            acceptedRequired: true,
            platform: fsData.platform === "android" ? "android" : "web",
            consentVersion: fsData.consentVersion,
            termsVersion: fsData.termsVersion,
            privacyVersion: fsData.privacyVersion,
            optionalConsents: fsData.optionalConsents
          });
          consent = synced.statusResponse;
        }
      }
    } catch (fsErr) {
      console.warn("Firestore consent lookup skipped in requireConsentAccepted:", fsErr.message);
    }
  }
  if (!consent.accessAllowed) {
    return res.status(403).json({
      error: "L\u2019acceptation des conditions d\u2019utilisation et de la politique de confidentialit\xE9 VRU Guard Sentinel est requise pour acc\xE9der \xE0 ce service.",
      code: "CONSENT_REQUIRED",
      consent
    });
  }
  next();
}
function getStripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new import_stripe.default(key);
}
function getPlanAmount(plan, billingCycle, currency) {
  return subscriptionStore.getPlanAmount(plan, billingCycle, currency);
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3e3;
  app.use(
    (0, import_cors.default)({
      origin: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"]
    })
  );
  app.post(
    "/api/subscriptions/webhook/stripe",
    import_express.default.raw({ type: "application/json" }),
    async (req, res) => {
      const stripe = getStripeClient();
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      const sig = req.headers["stripe-signature"];
      if (!stripe || !webhookSecret || !sig) {
        return res.status(400).json({ error: "Stripe webhook non configur\xE9." });
      }
      let event;
      try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      } catch (err) {
        console.error("Stripe webhook signature verification failed:", err.message);
        return res.status(400).json({ error: "Signature webhook invalide." });
      }
      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        if (session.payment_status === "paid" && session.metadata?.uid && session.metadata?.plan) {
          const uid = session.metadata.uid;
          const plan = session.metadata.plan;
          const billingCycle = session.metadata.billingCycle || "monthly";
          const metaCurrency = session.metadata?.currency?.toUpperCase();
          const sessionCurrency = session.currency?.toUpperCase();
          const currency = metaCurrency === "TND" || sessionCurrency === "TND" ? "TND" : "EUR";
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
            country
          });
          await mirrorSubscriptionToAdminFirestore(updated);
        }
      }
      res.json({ received: true });
    }
  );
  app.use(import_express.default.json({ limit: "12mb" }));
  const server = import_http.default.createServer(app);
  const wss = new import_ws.WebSocketServer({ server });
  const tcpConnections = /* @__PURE__ */ new Map();
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
          const tcpSocket = new import_net.default.Socket();
          tcpConnections.set(ws, tcpSocket);
          tcpSocket.connect(port, host, () => {
            if (ws.readyState === import_ws.WebSocket.OPEN) {
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
              if (line && ws.readyState === import_ws.WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "teria_data", payload: line }));
              }
            }
          });
          tcpSocket.on("error", (err) => {
            if (ws.readyState === import_ws.WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "teria_error", error: err.message }));
            }
          });
          tcpSocket.on("close", () => {
            if (ws.readyState === import_ws.WebSocket.OPEN) {
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
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });
  app.get("/api/pricing/geo", async (req, res) => {
    const geo = await resolveVisitorGeo(req);
    res.json(geo);
  });
  app.get("/api/platform/public-config", async (req, res) => {
    const geo = await resolveVisitorGeo(req);
    res.json({
      config: subscriptionStore.getPublicPlatformConfig(),
      geo
    });
  });
  app.get("/api/auth/session-status", async (req, res) => {
    try {
      const tokenResult = await extractVerifiedToken(req);
      if (!tokenResult) {
        return res.status(401).json({ error: "Authentification requise.", code: "UNAUTHENTICATED" });
      }
      const { decoded, idToken } = tokenResult;
      const authTimeMs = (decoded.auth_time || Math.floor(Date.now() / 1e3)) * 1e3;
      const email = decoded.email || null;
      const emailVerified = Boolean(decoded.email_verified);
      const createdAtMs = await fetchUserCreatedAtMs(decoded.uid, idToken);
      const dir = subscriptionStore.upsertDirectoryUser({
        uid: decoded.uid,
        email,
        displayName: decoded.name || null,
        photoURL: decoded.picture || null,
        emailVerified,
        createdAt: createdAtMs,
        lastLoginAt: Date.now()
      });
      const sessionRevoked = Boolean(dir.revokedAfter && authTimeMs < dir.revokedAfter);
      const sub = subscriptionStore.getUserSubscription(decoded.uid, {
        email,
        userCreatedAtMs: createdAtMs
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
        restrictionReason: dir.accountStatus === "banned" ? dir.banReason || "Compte banni par l\u2019administration." : dir.accountStatus === "suspended" ? dir.suspensionReason || "Compte temporairement suspendu." : dir.accountStatus === "soft_deleted" ? "Compte d\xE9sactiv\xE9." : null,
        suspensionExpiresAt: dir.suspensionExpiresAt || null,
        subscription: sub,
        consent: subscriptionStore.getUserConsentStatus(decoded.uid),
        unreadNotifications: dir.accountStatus === "active" && !sessionRevoked ? subscriptionStore.getNotificationsForUser(decoded.uid, email, sub.effectivePlan) : [],
        publicConfig: subscriptionStore.getPublicPlatformConfig(),
        geo: await resolveVisitorGeo(req)
      });
    } catch {
      return res.status(401).json({ error: "Jeton invalide.", code: "INVALID_TOKEN" });
    }
  });
  app.post("/api/presence/heartbeat", authenticateRequest, (req, res) => {
    const { state = "online", lastInteractionAt, sessionId, currentPage } = req.body || {};
    const presence = subscriptionStore.updatePresenceHeartbeat({
      uid: req.authUser.uid,
      state: state === "idle" ? "idle" : "online",
      lastInteractionAt: typeof lastInteractionAt === "number" ? lastInteractionAt : Date.now(),
      sessionId: typeof sessionId === "string" ? sessionId.slice(0, 64) : void 0,
      currentPage: typeof currentPage === "string" ? currentPage.slice(0, 120) : void 0
    });
    res.json({ presence });
  });
  app.post("/api/presence/offline", async (req, res) => {
    try {
      let uid = null;
      const tokenResult = await extractVerifiedToken(req);
      if (tokenResult) {
        uid = tokenResult.decoded.uid;
      } else if (req.body?.idToken) {
        const decoded = await (0, import_auth.getAuth)().verifyIdToken(String(req.body.idToken));
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
  app.get("/api/user/notifications", authenticateRequest, (req, res) => {
    const notifications = subscriptionStore.getNotificationsForUser(
      req.authUser.uid,
      req.authUser.email,
      req.userSubscription.effectivePlan
    );
    res.json({ notifications });
  });
  app.post(
    "/api/user/notifications/:id/read",
    authenticateRequest,
    (req, res) => {
      const notifId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      subscriptionStore.markNotificationRead(notifId, req.authUser.uid);
      res.json({ read: true });
    }
  );
  app.get(
    "/api/user/consent-status",
    authenticateRequest,
    (req, res) => {
      const consent = subscriptionStore.getUserConsentStatus(req.authUser.uid);
      res.json({ consent });
    }
  );
  app.post(
    "/api/user/accept-consent",
    authenticateRequest,
    (req, res) => {
      const ip = getClientIp(req);
      if (!checkRateLimit(`consent:${req.authUser.uid}:${ip}`, 30, 5 * 6e4)) {
        return res.status(429).json({
          error: "Trop de requ\xEAtes de consentement. Patientez quelques instants."
        });
      }
      try {
        const body = req.body || {};
        const platformRaw = typeof body.platform === "string" ? body.platform.toLowerCase().trim() : "";
        if (platformRaw !== "web" && platformRaw !== "android") {
          return res.status(400).json({
            error: "Plateforme invalide (web ou android requis)."
          });
        }
        const result = subscriptionStore.acceptUserConsent({
          uid: req.authUser.uid,
          email: req.authUser.email,
          platform: platformRaw,
          consentVersion: typeof body.consentVersion === "string" ? body.consentVersion : void 0,
          termsVersion: typeof body.termsVersion === "string" ? body.termsVersion : void 0,
          privacyVersion: typeof body.privacyVersion === "string" ? body.privacyVersion : void 0,
          acceptedRequired: body.acceptedRequired === true,
          optionalConsents: {
            notifications: body.optionalConsents?.notifications === true,
            locationEnhancements: body.optionalConsents?.locationEnhancements === true
          },
          ip
        });
        return res.status(200).json({
          accepted: true,
          alreadyAccepted: result.alreadyAccepted,
          consent: result.statusResponse
        });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
  );
  app.post(
    "/api/user/refuse-consent",
    authenticateRequest,
    (req, res) => {
      const ip = getClientIp(req);
      try {
        const body = req.body || {};
        const platformRaw = typeof body.platform === "string" ? body.platform.toLowerCase().trim() : "web";
        const platform = platformRaw === "android" ? "android" : "web";
        const consent = subscriptionStore.refuseUserConsent({
          uid: req.authUser.uid,
          email: req.authUser.email,
          platform,
          ip
        });
        return res.status(200).json({
          refused: true,
          consent
        });
      } catch (err) {
        return res.status(409).json({ error: err.message });
      }
    }
  );
  app.patch(
    "/api/user/consent-preferences",
    authenticateRequest,
    (req, res) => {
      const ip = getClientIp(req);
      try {
        const body = req.body || {};
        const platformRaw = typeof body.platform === "string" ? body.platform.toLowerCase().trim() : "web";
        const platform = platformRaw === "android" ? "android" : "web";
        const consent = subscriptionStore.updateOptionalConsents({
          uid: req.authUser.uid,
          email: req.authUser.email,
          platform,
          optionalConsents: body.optionalConsents || {},
          ip
        });
        return res.status(200).json({ consent });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
  );
  app.post(
    "/api/user/withdraw-consent",
    authenticateRequest,
    (req, res) => {
      const ip = getClientIp(req);
      try {
        const body = req.body || {};
        const platformRaw = typeof body.platform === "string" ? body.platform.toLowerCase().trim() : "web";
        const platform = platformRaw === "android" ? "android" : "web";
        const consent = subscriptionStore.withdrawUserConsent({
          uid: req.authUser.uid,
          email: req.authUser.email,
          platform,
          ip
        });
        return res.status(200).json({ withdrawn: true, consent });
      } catch (err) {
        return res.status(400).json({ error: err.message });
      }
    }
  );
  app.get("/api/accessibility/me", authenticateRequest, async (req, res) => {
    await hydrateAccessibilityFromAdminFirestore(req.authUser.uid);
    const requests = subscriptionStore.listAccessibilityRequests(req.authUser.uid);
    res.json({ requests });
  });
  app.post(
    "/api/accessibility/apply",
    authenticateRequest,
    requireConsentAccepted,
    async (req, res) => {
      const ip = getClientIp(req);
      if (!checkRateLimit(`acc:${req.authUser.uid}:${ip}`, 10, 60 * 60 * 1e3)) {
        return res.status(429).json({ error: "Trop de tentatives. R\xE9essayez plus tard." });
      }
      try {
        const { fullName, disabilityCategory, description, documentName, documentMimeType, documentBase64 } = req.body || {};
        if (!fullName || !disabilityCategory || !description) {
          return res.status(400).json({ error: "Nom complet, situation et description requis." });
        }
        const created = subscriptionStore.submitAccessibilityRequest({
          uid: req.authUser.uid,
          email: req.authUser.email,
          displayName: req.authUser.name,
          fullName: String(fullName),
          disabilityCategory: String(disabilityCategory),
          description: String(description),
          documentName: String(documentName || "justificatif.pdf"),
          documentMimeType: String(documentMimeType || "application/pdf"),
          documentBase64: typeof documentBase64 === "string" ? documentBase64 : void 0
        });
        await mirrorAccessibilityToAdminFirestore(
          created,
          typeof documentBase64 === "string" ? documentBase64 : void 0
        );
        res.status(201).json({ request: created });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.post("/api/support/tickets", async (req, res) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`support:${ip}`, 15, 60 * 60 * 1e3)) {
      return res.status(429).json({ error: "Trop de demandes support envoy\xE9es. Patientez." });
    }
    const { email, name, subject, category, priority, message } = req.body || {};
    if (!email || !subject || !message) {
      return res.status(400).json({ error: "E-mail, sujet et message requis." });
    }
    let uid = null;
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
      message: String(message)
    });
    res.status(201).json({ ticket });
  });
  app.get("/api/support/my-tickets", authenticateRequest, (req, res) => {
    const tickets = subscriptionStore.listSupportTickets(req.authUser.uid);
    res.json({ tickets });
  });
  app.post(
    "/api/support/my-tickets/:id/reply",
    authenticateRequest,
    (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const ticket = subscriptionStore.listSupportTickets(req.authUser.uid).find((t) => t.id === id);
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
        senderEmail: req.authUser.email || req.authUser.uid
      });
      res.json({ ticket: updated });
    }
  );
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
          annualPriceEur: prices.premiumAnnualEur
        };
      }
      if (p.id === "FAMILY") {
        return {
          ...p,
          enabled: reg?.enabled ?? true,
          monthlyPriceTnd: prices.familyMonthlyTnd,
          annualPriceTnd: prices.familyAnnualTnd,
          monthlyPriceEur: prices.familyMonthlyEur,
          annualPriceEur: prices.familyAnnualEur
        };
      }
      return {
        ...p,
        enabled: reg?.enabled ?? true
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
        EUR: getCompatibleProvidersForCurrency("EUR")
      },
      paymentGatewaysConfigured: {
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
        konnect: Boolean(process.env.KONNECT_API_KEY && process.env.KONNECT_WALLET_ID)
      }
    });
  });
  app.post("/api/subscriptions/quote", async (req, res) => {
    try {
      const { plan, billingCycle = "monthly", provider = "stripe", country, currency } = req.body || {};
      if (plan !== "PREMIUM" && plan !== "FAMILY") {
        return res.status(400).json({ error: "Plan payant invalide. Choisissez PREMIUM ou FAMILY." });
      }
      if (billingCycle !== "monthly" && billingCycle !== "annual") {
        return res.status(400).json({ error: "Cycle de facturation invalide." });
      }
      if (!subscriptionStore.isPlanEnabled(plan)) {
        return res.status(403).json({
          code: "PLAN_DISABLED",
          error: `Le plan ${plan} est actuellement d\xE9sactiv\xE9 par l\u2019administration.`
        });
      }
      const geo = await resolveVisitorGeo(req);
      const cleanCountry = typeof country === "string" && /^[A-Za-z]{2}$/.test(country.trim()) ? country.trim().toUpperCase() : geo.country;
      const authorizedCurrency = currency === "TND" || currency === "EUR" ? currency : getCurrencyForCountry(cleanCountry);
      if (provider !== "stripe" && provider !== "konnect") {
        return res.status(400).json({ error: "Prestataire de paiement non support\xE9." });
      }
      if (!isProviderCompatibleWithCurrency(provider, authorizedCurrency)) {
        return res.status(400).json({
          code: "CURRENCY_PROVIDER_INCOMPATIBLE",
          error: `Le prestataire ${provider === "konnect" ? "Konnect" : provider} ne supporte pas la devise ${authorizedCurrency}. Utilisez Stripe pour payer en EUR.`,
          currency: authorizedCurrency,
          allowedProviders: getCompatibleProvidersForCurrency(authorizedCurrency)
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
        compatible: true
      });
    } catch (err) {
      return res.status(400).json({ error: err.message || "Erreur de tarification." });
    }
  });
  app.get("/api/subscriptions/me", authenticateRequest, async (req, res) => {
    const sub = req.userSubscription;
    await mirrorSubscriptionToAdminFirestore(sub);
    res.json({
      subscription: sub,
      paymentGatewaysConfigured: {
        stripe: Boolean(process.env.STRIPE_SECRET_KEY),
        konnect: Boolean(process.env.KONNECT_API_KEY && process.env.KONNECT_WALLET_ID)
      }
    });
  });
  app.post(
    "/api/subscriptions/checkout",
    authenticateRequest,
    requireConsentAccepted,
    async (req, res) => {
      try {
        const {
          plan,
          billingCycle = "monthly",
          provider = "stripe",
          country,
          currency
        } = req.body || {};
        if (plan !== "PREMIUM" && plan !== "FAMILY") {
          return res.status(400).json({ error: "Plan payant invalide. Choisissez PREMIUM ou FAMILY." });
        }
        if (billingCycle !== "monthly" && billingCycle !== "annual") {
          return res.status(400).json({ error: "Cycle de facturation invalide." });
        }
        if (provider !== "stripe" && provider !== "konnect") {
          return res.status(400).json({ error: "Prestataire de paiement non support\xE9." });
        }
        if (!subscriptionStore.isPlanEnabled(plan)) {
          return res.status(403).json({
            code: "PLAN_DISABLED",
            error: `La formule ${plan} est actuellement d\xE9sactiv\xE9e par l\u2019administration.`
          });
        }
        const currentSub = req.userSubscription;
        if (plan === "PREMIUM" && currentSub.isEarlyTester && currentSub.earlyTesterEndDate && currentSub.earlyTesterEndDate > Date.now()) {
          return res.status(409).json({
            code: "EARLY_TESTER_ACTIVE",
            error: "Votre acc\xE8s gratuit Pioneer de 2 ans \xE0 VruGuard Premium est d\xE9j\xE0 actif. Aucun paiement n'est requis pendant cette p\xE9riode.",
            earlyTesterEndDate: currentSub.earlyTesterEndDate
          });
        }
        const geo = await resolveVisitorGeo(req);
        const resolvedCountry = typeof country === "string" && /^[A-Za-z]{2}$/.test(country.trim()) ? country.trim().toUpperCase() : geo.country;
        const authorizedCurrency = currency === "TND" || currency === "EUR" ? currency : getCurrencyForCountry(resolvedCountry);
        if (!isProviderCompatibleWithCurrency(provider, authorizedCurrency)) {
          return res.status(400).json({
            code: "CURRENCY_PROVIDER_INCOMPATIBLE",
            error: provider === "konnect" ? "Konnect accepte uniquement les paiements en TND. S\xE9lectionnez Stripe pour payer en EUR." : `Le prestataire ${provider} ne supporte pas la devise ${authorizedCurrency}.`,
            currency: authorizedCurrency,
            allowedProviders: getCompatibleProvidersForCurrency(authorizedCurrency)
          });
        }
        const authorizedAmount = getPlanAmount(plan, billingCycle, authorizedCurrency);
        const rawOrigin = typeof req.headers.origin === "string" ? req.headers.origin.trim() : "";
        let trustedOrigin = null;
        if (rawOrigin) {
          try {
            const parsedOrigin = new URL(rawOrigin);
            const host = parsedOrigin.hostname.toLowerCase();
            if (host === "www.vruguard.me" || host === "vruguard.me" || host === "localhost" || host === "127.0.0.1" || /^ais-(dev|pre)-[a-z0-9-]+(?:\.[a-z0-9-]+)*\.run\.app$/i.test(host)) {
              trustedOrigin = parsedOrigin.origin;
            }
          } catch {
            trustedOrigin = null;
          }
        }
        const appUrl = trustedOrigin || process.env.APP_URL || `${req.protocol}://${req.get("host")}`;
        if (provider === "konnect") {
          if (!process.env.KONNECT_API_KEY || !process.env.KONNECT_WALLET_ID) {
            return res.status(503).json({
              code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
              error: "La passerelle Konnect (TND) n'est pas configur\xE9e sur le serveur (KONNECT_API_KEY requis). Utilisez un code Redeem officiel.",
              quote: {
                plan,
                billingCycle,
                amount: authorizedAmount,
                currency: authorizedCurrency,
                country: resolvedCountry,
                provider
              }
            });
          }
          const orderId = `VRU-${req.authUser.uid.slice(0, 8)}-${Date.now()}`;
          const konnectResp = await fetch("https://api.konnect.network/api/v2/payments/init-payment", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.KONNECT_API_KEY
            },
            body: JSON.stringify({
              receiverWalletId: process.env.KONNECT_WALLET_ID,
              token: "TND",
              amount: Math.round(authorizedAmount * 1e3),
              type: "immediate",
              description: `VruGuard ${plan} (${billingCycle})`,
              acceptedPaymentMethods: ["wallet", "bank_card", "e-DINAR"],
              orderId,
              successUrl: `${appUrl}/?view=pricing&provider=konnect&orderId=${encodeURIComponent(orderId)}`,
              failUrl: `${appUrl}/?view=pricing&payment_status=failed`,
              email: req.authUser.email || void 0
            })
          });
          const konnectData = await konnectResp.json();
          if (!konnectResp.ok || !konnectData?.payUrl || !konnectData?.paymentRef) {
            return res.status(502).json({
              error: "Erreur lors de l'initialisation du paiement Konnect.",
              details: konnectData
            });
          }
          subscriptionStore.createPendingTransaction({
            uid: req.authUser.uid,
            plan,
            billingCycle,
            amount: authorizedAmount,
            currency: "TND",
            country: resolvedCountry || "TN",
            provider: "konnect",
            providerSessionId: konnectData.paymentRef
          });
          return res.json({
            checkoutUrl: konnectData.payUrl,
            sessionId: konnectData.paymentRef,
            provider: "konnect",
            amount: authorizedAmount,
            currency: "TND",
            country: resolvedCountry || "TN"
          });
        }
        const stripe = getStripeClient();
        if (stripe) {
          const session = await stripe.checkout.sessions.create({
            mode: "payment",
            customer_email: req.authUser.email || void 0,
            line_items: [
              {
                price_data: {
                  currency: authorizedCurrency.toLowerCase(),
                  product_data: {
                    name: `VruGuard ${plan} (${billingCycle === "annual" ? "Annuel" : "Mensuel"})`,
                    description: plan === "PREMIUM" ? "SOS, contacts d'urgence, alertes automatiques et protection avanc\xE9e" : "Protection familiale multi-profils jusqu'\xE0 6 membres + Premium complet"
                  },
                  unit_amount: toStripeUnitAmount(authorizedAmount, authorizedCurrency)
                },
                quantity: 1
              }
            ],
            metadata: {
              uid: req.authUser.uid,
              plan,
              billingCycle,
              currency: authorizedCurrency,
              country: resolvedCountry || ""
            },
            success_url: `${appUrl}/?view=pricing&provider=stripe&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${appUrl}/?view=pricing&payment_status=cancelled`
          });
          subscriptionStore.createPendingTransaction({
            uid: req.authUser.uid,
            plan,
            billingCycle,
            amount: authorizedAmount,
            currency: authorizedCurrency,
            country: resolvedCountry,
            provider: "stripe",
            providerSessionId: session.id
          });
          return res.json({
            checkoutUrl: session.url,
            sessionId: session.id,
            provider: "stripe",
            amount: authorizedAmount,
            currency: authorizedCurrency,
            country: resolvedCountry
          });
        }
        return res.status(503).json({
          code: "PAYMENT_GATEWAY_NOT_CONFIGURED",
          error: "Aucune passerelle de paiement n'est configur\xE9e sur le serveur (STRIPE_SECRET_KEY ou KONNECT_API_KEY requis). Utilisez un code Redeem officiel.",
          quote: {
            plan,
            billingCycle,
            amount: authorizedAmount,
            currency: authorizedCurrency,
            country: resolvedCountry,
            provider
          }
        });
      } catch (err) {
        console.error("Checkout error:", err);
        return res.status(500).json({ error: err.message || "Erreur serveur checkout." });
      }
    }
  );
  app.post(
    "/api/subscriptions/verify-payment",
    authenticateRequest,
    requireConsentAccepted,
    async (req, res) => {
      try {
        const { provider, sessionId, paymentRef } = req.body;
        if (provider === "stripe") {
          const stripe = getStripeClient();
          if (!stripe || !sessionId) {
            return res.status(400).json({ error: "Stripe non configur\xE9 ou sessionId manquant." });
          }
          const session = await stripe.checkout.sessions.retrieve(sessionId);
          if (session.metadata?.uid !== req.authUser.uid) {
            return res.status(403).json({ error: "Cette session de paiement n'appartient pas \xE0 cet utilisateur." });
          }
          if (session.payment_status !== "paid") {
            return res.status(402).json({ error: "Paiement non confirm\xE9 par Stripe.", status: session.payment_status });
          }
          const plan = session.metadata?.plan || "PREMIUM";
          const billingCycle = session.metadata?.billingCycle || "monthly";
          const metaCurrency = session.metadata?.currency?.toUpperCase();
          const sessionCurrency = session.currency?.toUpperCase();
          const currency = metaCurrency === "TND" || sessionCurrency === "TND" ? "TND" : "EUR";
          const country = session.metadata?.country || null;
          const tx = subscriptionStore.findTransactionByProviderSession(session.id);
          const amount = tx?.amount ?? getPlanAmount(plan, billingCycle, currency);
          const updated = subscriptionStore.activateVerifiedSubscription({
            uid: req.authUser.uid,
            plan,
            billingCycle,
            provider: "stripe",
            paymentRef: session.id,
            amount,
            currency,
            country
          });
          await mirrorSubscriptionToAdminFirestore(updated);
          return res.json({ verified: true, subscription: updated });
        }
        if (provider === "konnect") {
          const ref = paymentRef || sessionId;
          if (!process.env.KONNECT_API_KEY || !ref) {
            return res.status(400).json({ error: "Konnect non configur\xE9 ou r\xE9f\xE9rence manquante." });
          }
          const tx = subscriptionStore.findTransactionByProviderSession(ref);
          if (!tx || tx.uid !== req.authUser.uid) {
            return res.status(403).json({ error: "Transaction introuvable pour cet utilisateur." });
          }
          const konnectResp = await fetch(`https://api.konnect.network/api/v2/payments/${encodeURIComponent(ref)}`, {
            headers: { "x-api-key": process.env.KONNECT_API_KEY }
          });
          const konnectData = await konnectResp.json();
          const paymentStatus = konnectData?.payment?.status;
          if (!konnectResp.ok || paymentStatus !== "completed") {
            return res.status(402).json({ error: "Paiement non confirm\xE9 par Konnect.", status: paymentStatus });
          }
          const updated = subscriptionStore.activateVerifiedSubscription({
            uid: req.authUser.uid,
            plan: tx.plan,
            billingCycle: tx.billingCycle,
            provider: "konnect",
            paymentRef: ref,
            amount: tx.amount,
            currency: "TND",
            country: tx.country || "TN"
          });
          await mirrorSubscriptionToAdminFirestore(updated);
          return res.json({ verified: true, subscription: updated });
        }
        return res.status(400).json({ error: "Fournisseur de paiement non support\xE9." });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  );
  app.post("/api/subscriptions/cancel", authenticateRequest, async (req, res) => {
    const updated = subscriptionStore.scheduleCancellation(req.authUser.uid);
    await mirrorSubscriptionToAdminFirestore(updated);
    res.json({ subscription: updated });
  });
  app.post(
    "/api/subscriptions/redeem",
    authenticateRequest,
    requireConsentAccepted,
    async (req, res) => {
      const ip = getClientIp(req);
      if (!checkRateLimit(`redeem:${req.authUser.uid}:${ip}`, 15, 5 * 6e4)) {
        return res.status(429).json({ error: "Trop de tentatives de code Redeem. Patientez 5 minutes." });
      }
      try {
        const { code, expectedPlan } = req.body || {};
        if (!code || typeof code !== "string" || !code.trim()) {
          return res.status(400).json({ error: "Veuillez saisir un code Redeem valide." });
        }
        if (expectedPlan && expectedPlan !== "PREMIUM" && expectedPlan !== "FAMILY" && expectedPlan !== "BUSINESS") {
          return res.status(400).json({ error: "Formule cible invalide." });
        }
        const result = subscriptionStore.redeemCodeForUser({
          uid: req.authUser.uid,
          email: req.authUser.email || null,
          code,
          expectedPlan
        });
        await mirrorSubscriptionToAdminFirestore(result.subscription);
        return res.json({
          activated: true,
          subscription: result.subscription,
          activation: result.activation,
          plan: result.codeRecord.plan,
          billingCycle: result.codeRecord.billingCycle,
          durationDays: result.codeRecord.durationDays
        });
      } catch (err) {
        return res.status(400).json({ error: err.message || "Activation Redeem impossible." });
      }
    }
  );
  app.post("/api/business/quote", async (req, res) => {
    const { companyName, contactName, email, phone, teamSize, vehicleCount, needsApi, message } = req.body || {};
    if (!companyName || !contactName || !email) {
      return res.status(400).json({ error: "Nom d'entreprise, contact et e-mail requis." });
    }
    let uid = null;
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
      message: String(message || "").slice(0, 2e3)
    });
    res.status(201).json({ quote });
  });
  app.post(
    "/api/sos/authorize",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("sos"),
    (req, res) => {
      res.json({
        authorized: true,
        effectivePlan: req.userSubscription.effectivePlan,
        timestamp: Date.now()
      });
    }
  );
  app.post(
    "/api/sos/settings-authorize",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("sos"),
    (req, res) => {
      res.json({ authorized: true, effectivePlan: req.userSubscription.effectivePlan });
    }
  );
  app.post(
    "/api/contacts/authorize",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("emergency_contacts"),
    (req, res) => {
      res.json({
        authorized: true,
        maxEmergencyContacts: req.userSubscription.entitlements.maxEmergencyContacts
      });
    }
  );
  app.get(
    "/api/family/profiles",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("family_dashboard"),
    (req, res) => {
      const profiles = subscriptionStore.getFamilyProfiles(req.authUser.uid);
      res.json({
        profiles,
        maxFamilyMembers: req.userSubscription.entitlements.maxFamilyMembers
      });
    }
  );
  app.post(
    "/api/family/profiles",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("family_management"),
    (req, res) => {
      try {
        const { name, relation, vruType, emergencyContactPhone, shareLocation, sosAlertsEnabled, geofenceAlertEnabled, speedAlertThresholdKmh } = req.body || {};
        if (!name || typeof name !== "string" || !name.trim()) {
          return res.status(400).json({ error: "Le nom du membre est requis." });
        }
        const profile = subscriptionStore.addFamilyProfile(
          req.authUser.uid,
          {
            name,
            relation: relation || "child",
            vruType,
            emergencyContactPhone,
            shareLocation,
            sosAlertsEnabled,
            geofenceAlertEnabled,
            speedAlertThresholdKmh
          },
          req.userSubscription.entitlements.maxFamilyMembers
        );
        res.status(201).json({ profile });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.patch(
    "/api/family/profiles/:id",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("family_member_settings"),
    (req, res) => {
      try {
        const profileId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const updated = subscriptionStore.updateFamilyProfile(req.authUser.uid, profileId, req.body || {});
        res.json({ profile: updated });
      } catch (err) {
        res.status(404).json({ error: err.message });
      }
    }
  );
  app.delete(
    "/api/family/profiles/:id",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("family_management"),
    (req, res) => {
      const profileId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      subscriptionStore.removeFamilyProfile(req.authUser.uid, profileId);
      res.json({ deleted: true });
    }
  );
  app.post("/api/super-admin/audit-denied", async (req, res) => {
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
    }
    subscriptionStore.recordAuditLog({
      adminUid: uid,
      adminEmail: email,
      adminRole: "USER",
      action: "UNAUTHORIZED_SUPER_ADMIN_ROUTE",
      category: "security",
      outcome: "denied",
      ip,
      detail: `Tentative d'acc\xE8s direct \xE0 /super-admin par ${email}`
    });
    res.status(403).json({ error: "Acc\xE8s refus\xE9.", code: "FORBIDDEN_SUPER_ADMIN_REQUIRED" });
  });
  app.get(
    "/api/super-admin/overview",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    async (req, res) => {
      const fsUsers = await fetchMergedUsersFromFirestore(req.authUser.idToken);
      const analytics = subscriptionStore.getOverviewAnalytics(fsUsers);
      const recentActivations = subscriptionStore.listRecentActivationsForAdmin(30);
      res.json({
        ...analytics,
        recentActivations,
        serverCapabilities: { hasAdminIam }
      });
    }
  );
  app.get(
    "/api/super-admin/users",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    async (req, res) => {
      const fsUsers = await fetchMergedUsersFromFirestore(req.authUser.idToken);
      let users = subscriptionStore.listAllUsersSummary(fsUsers);
      const search = String(req.query.search || "").trim().toLowerCase();
      const planFilter = String(req.query.plan || "ALL");
      const accountStatusFilter = String(req.query.accountStatus || "ALL");
      const presenceFilter = String(req.query.presence || "ALL");
      const sortBy = String(req.query.sortBy || "createdAt");
      const sortDir = String(req.query.sortDir || "desc") === "asc" ? 1 : -1;
      if (search) {
        users = users.filter(
          (u) => u.uid.toLowerCase().includes(search) || (u.email || "").toLowerCase().includes(search) || (u.displayName || "").toLowerCase().includes(search)
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
        presenceSummary: subscriptionStore.listPresenceSummary()
      });
    }
  );
  app.get(
    "/api/super-admin/users/:uid",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    async (req, res) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      const fsUsers = await fetchMergedUsersFromFirestore(req.authUser.idToken);
      const all = subscriptionStore.listAllUsersSummary(fsUsers);
      const user = all.find((u) => u.uid === targetUid);
      if (!user) {
        return res.status(404).json({ error: "Utilisateur introuvable." });
      }
      const accessibilityRequests = subscriptionStore.listAccessibilityRequests(targetUid);
      const supportTickets = subscriptionStore.listSupportTickets(targetUid);
      const familyProfiles = subscriptionStore.getFamilyProfiles(targetUid);
      const auditLogs = subscriptionStore.listAuditLogs({ limit: 100 }).filter((l) => l.targetUid === targetUid);
      res.json({
        user,
        accessibilityRequests,
        supportTickets,
        familyProfilesCount: familyProfiles.length,
        auditLogs
      });
    }
  );
  app.post(
    "/api/super-admin/users/:uid/suspend",
    authenticateRequest,
    requireSuperAdminPermission("users:suspend"),
    async (req, res) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      if (targetUid === req.authUser.uid) {
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
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      if (hasAdminIam) {
        await (0, import_auth.getAuth)().revokeRefreshTokens(targetUid).catch(() => {
        });
      }
      res.json({ user: updated });
    }
  );
  app.post(
    "/api/super-admin/users/:uid/ban",
    authenticateRequest,
    requireSuperAdminPermission("users:ban", true),
    requireRecentReauth,
    async (req, res) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      if (targetUid === req.authUser.uid) {
        return res.status(400).json({ error: "Impossible de bannir votre propre compte Super Admin." });
      }
      const { reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: "Un motif de bannissement est obligatoire." });
      }
      const updated = subscriptionStore.banUser({
        targetUid,
        reason: String(reason),
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      if (hasAdminIam) {
        await (0, import_auth.getAuth)().updateUser(targetUid, { disabled: true }).catch(() => {
        });
        await (0, import_auth.getAuth)().revokeRefreshTokens(targetUid).catch(() => {
        });
      }
      res.json({ user: updated });
    }
  );
  app.post(
    "/api/super-admin/users/:uid/unban",
    authenticateRequest,
    requireSuperAdminPermission("users:ban", true),
    async (req, res) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      const { reason } = req.body || {};
      const updated = subscriptionStore.unbanOrReactivateUser({
        targetUid,
        reason: reason ? String(reason) : void 0,
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      if (hasAdminIam) {
        await (0, import_auth.getAuth)().updateUser(targetUid, { disabled: false }).catch(() => {
        });
      }
      res.json({ user: updated });
    }
  );
  app.post(
    "/api/super-admin/users/:uid/revoke-sessions",
    authenticateRequest,
    requireSuperAdminPermission("security:write", true),
    async (req, res) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      const { reason } = req.body || {};
      const updated = subscriptionStore.revokeUserSessions({
        targetUid,
        reason: reason ? String(reason) : void 0,
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      if (hasAdminIam) {
        await (0, import_auth.getAuth)().revokeRefreshTokens(targetUid).catch(() => {
        });
      }
      res.json({ user: updated });
    }
  );
  app.post(
    "/api/super-admin/users/:uid/soft-delete",
    authenticateRequest,
    requireSuperAdminPermission("users:delete", true),
    async (req, res) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      if (targetUid === req.authUser.uid) {
        return res.status(400).json({ error: "Impossible de supprimer votre propre compte Super Admin." });
      }
      const { reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: "Un motif est obligatoire." });
      }
      const updated = subscriptionStore.softDeleteUser({
        targetUid,
        reason: String(reason),
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      if (hasAdminIam) {
        await (0, import_auth.getAuth)().updateUser(targetUid, { disabled: true }).catch(() => {
        });
        await (0, import_auth.getAuth)().revokeRefreshTokens(targetUid).catch(() => {
        });
      }
      res.json({ user: updated });
    }
  );
  app.delete(
    "/api/super-admin/users/:uid",
    authenticateRequest,
    requireSuperAdminPermission("users:delete", true),
    requireRecentReauth,
    async (req, res) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      if (targetUid === req.authUser.uid) {
        return res.status(400).json({ error: "Impossible de supprimer votre propre compte Super Admin." });
      }
      const { confirmPhrase, reason } = req.body || {};
      if (confirmPhrase !== "SUPPRIMER DEFINITIVEMENT") {
        return res.status(400).json({
          error: "Confirmation explicite requise : saisissez exactement SUPPRIMER DEFINITIVEMENT."
        });
      }
      const result = subscriptionStore.hardDeleteUser({
        targetUid,
        reason: String(reason || "Suppression d\xE9finitive par Super Admin"),
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      if (hasAdminIam) {
        await (0, import_auth.getAuth)().deleteUser(targetUid).catch(() => {
        });
        if (adminFirestore) {
          await adminFirestore.collection("users").doc(targetUid).delete().catch(() => {
          });
          await adminFirestore.collection("public_profiles").doc(targetUid).delete().catch(() => {
          });
          await adminFirestore.collection("subscriptions").doc(targetUid).delete().catch(() => {
          });
        }
      }
      res.json({ deleted: true, ...result });
    }
  );
  app.post(
    "/api/super-admin/users/:uid/subscription",
    authenticateRequest,
    requireSuperAdminPermission("subscriptions:write"),
    async (req, res) => {
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
        targetEmail
      } = req.body || {};
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
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      await mirrorSubscriptionToAdminFirestore(updated);
      res.json({ subscription: updated });
    }
  );
  app.get(
    "/api/super-admin/redeem-codes",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req, res) => {
      const codes = subscriptionStore.listRedeemCodesForAdmin();
      res.json({
        codes,
        stats: subscriptionStore.getAdminOverviewStats()
      });
    }
  );
  app.post(
    "/api/super-admin/redeem-codes",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req, res) => {
      const {
        plan = "PREMIUM",
        durationCode = "1m",
        billingCycle,
        count = 1,
        maxUses = 1,
        expiresAt = null,
        campaign,
        note
      } = req.body || {};
      if (plan !== "PREMIUM" && plan !== "FAMILY" && plan !== "BUSINESS") {
        return res.status(400).json({ error: "Plan invalide (PREMIUM, FAMILY ou BUSINESS)." });
      }
      const allowedDurations = ["1m", "3m", "6m", "12m", "24m", "lifetime"];
      if (!allowedDurations.includes(durationCode)) {
        return res.status(400).json({ error: "Dur\xE9e invalide." });
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
        createdBy: req.authUser.email || req.authUser.uid,
        adminUid: req.authUser.uid,
        ip: getClientIp(req)
      });
      res.status(201).json({
        generatedCodes: created,
        maskedCodes: subscriptionStore.listRedeemCodesForAdmin(),
        stats: subscriptionStore.getAdminOverviewStats()
      });
    }
  );
  app.post(
    "/api/super-admin/redeem-codes/:id/revoke",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const code = subscriptionStore.updateRedeemCodeStatus({
          idOrCode: id,
          action: "revoke",
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid,
          ip: getClientIp(req)
        });
        res.json({ code, stats: subscriptionStore.getAdminOverviewStats() });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.post(
    "/api/super-admin/redeem-codes/:id/disable",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const code = subscriptionStore.updateRedeemCodeStatus({
          idOrCode: id,
          action: "disable",
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid,
          ip: getClientIp(req)
        });
        res.json({ code, stats: subscriptionStore.getAdminOverviewStats() });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.post(
    "/api/super-admin/redeem-codes/:id/enable",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const code = subscriptionStore.updateRedeemCodeStatus({
          idOrCode: id,
          action: "enable",
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid,
          ip: getClientIp(req)
        });
        res.json({ code, stats: subscriptionStore.getAdminOverviewStats() });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.get(
    "/api/super-admin/redeem-codes/export-csv",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req, res) => {
      const codes = subscriptionStore.listRedeemCodesForAdmin();
      const header = "id,maskedCode,plan,durationCode,status,usesCount,maxUses,campaign,createdBy,createdAt,expiresAt,usedByEmail\n";
      const rows = codes.map(
        (c) => [
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
          JSON.stringify(c.usedByEmail || "")
        ].join(",")
      ).join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="vruguard-redeem-codes-${Date.now()}.csv"`);
      res.send(header + rows);
    }
  );
  app.get(
    "/api/super-admin/accessibility",
    authenticateRequest,
    requireSuperAdminPermission("accessibility:review"),
    async (req, res) => {
      await hydrateAccessibilityFromAdminFirestore();
      const requests = subscriptionStore.listAccessibilityRequests();
      res.json({ requests });
    }
  );
  app.get(
    "/api/super-admin/accessibility/:id/document",
    authenticateRequest,
    requireSuperAdminPermission("accessibility:review"),
    async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const docFile = subscriptionStore.getAccessibilityDocumentFile(id);
      if (docFile) {
        res.setHeader("Content-Type", docFile.mimeType);
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${docFile.fileName.replace(/"/g, "")}"`
        );
        import_fs4.default.createReadStream(docFile.filePath).pipe(res);
        return;
      }
      if (adminFirestore) {
        try {
          const snap = await adminFirestore.collection("accessibility_requests").doc(id).get();
          if (snap.exists) {
            const data = snap.data();
            if (typeof data?.documentDataUrl === "string" && data.documentDataUrl.includes(",")) {
              const base64Part = data.documentDataUrl.split(",")[1];
              const buf = Buffer.from(base64Part, "base64");
              const mime = data.documentMimeType || "application/octet-stream";
              const fname = String(data.documentName || "justificatif").replace(/"/g, "");
              res.setHeader("Content-Type", mime);
              res.setHeader("Content-Disposition", `inline; filename="${fname}"`);
              res.send(buf);
              return;
            }
          }
        } catch {
        }
      }
      return res.status(404).json({ error: "Document justificatif introuvable." });
    }
  );
  app.post(
    "/api/super-admin/accessibility/:id/decision",
    authenticateRequest,
    requireSuperAdminPermission("accessibility:review"),
    async (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { decision, comment } = req.body || {};
        if (decision !== "approved" && decision !== "rejected" && decision !== "more_info_required") {
          return res.status(400).json({ error: "D\xE9cision invalide." });
        }
        await hydrateAccessibilityFromAdminFirestore();
        const result = subscriptionStore.reviewAccessibilityRequest({
          requestId: id,
          decision,
          comment,
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid,
          ip: getClientIp(req)
        });
        await mirrorAccessibilityToAdminFirestore(result.request);
        if (result.subscription) {
          await mirrorSubscriptionToAdminFirestore(result.subscription);
        }
        res.json(result);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.get(
    "/api/super-admin/pioneer",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    async (req, res) => {
      const fsUsers = await fetchMergedUsersFromFirestore(req.authUser.idToken);
      subscriptionStore.listAllUsersSummary(fsUsers);
      res.json(subscriptionStore.listPioneerData());
    }
  );
  app.post(
    "/api/super-admin/pioneer/grant",
    authenticateRequest,
    requireSuperAdminPermission("pioneer:write", true),
    async (req, res) => {
      const { uid, email, durationDays, note } = req.body || {};
      if (!uid && !email) {
        return res.status(400).json({ error: "uid ou email requis." });
      }
      const updated = subscriptionStore.grantEarlyTester({
        uid,
        email,
        durationDays: durationDays ? Number(durationDays) : void 0,
        note,
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      if (updated) await mirrorSubscriptionToAdminFirestore(updated);
      res.json({ granted: true, subscription: updated, ...subscriptionStore.listPioneerData() });
    }
  );
  app.post(
    "/api/super-admin/pioneer/revoke",
    authenticateRequest,
    requireSuperAdminPermission("pioneer:write", true),
    (req, res) => {
      const { uid, email, reason } = req.body || {};
      if (!reason || !String(reason).trim()) {
        return res.status(400).json({ error: "Motif requis." });
      }
      subscriptionStore.revokePioneerAccess({
        uid,
        email,
        reason: String(reason),
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      res.json({ revoked: true, ...subscriptionStore.listPioneerData() });
    }
  );
  app.get(
    "/api/super-admin/audit-logs",
    authenticateRequest,
    requireSuperAdminPermission("audit:read"),
    (req, res) => {
      const logs = subscriptionStore.listAuditLogs({
        category: String(req.query.category || "ALL"),
        outcome: String(req.query.outcome || "ALL"),
        search: String(req.query.search || ""),
        limit: Number(req.query.limit) || 250
      });
      res.json({ logs });
    }
  );
  app.get(
    "/api/super-admin/settings",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    (req, res) => {
      res.json({
        settings: subscriptionStore.getPlatformSettings(),
        priceHistory: subscriptionStore.getPriceChangeHistory(150)
      });
    }
  );
  app.put(
    "/api/super-admin/settings",
    authenticateRequest,
    requireSuperAdminPermission("settings:write", true),
    requireRecentReauth,
    (req, res) => {
      const settings = subscriptionStore.updatePlatformSettings({
        updates: req.body || {},
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      res.json({
        settings,
        priceHistory: subscriptionStore.getPriceChangeHistory(150)
      });
    }
  );
  app.get(
    "/api/super-admin/pricing",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    (req, res) => {
      const settings = subscriptionStore.getPlatformSettings();
      res.json({
        planPrices: settings.planPrices,
        regionalPlans: settings.regionalPlans,
        priceHistory: subscriptionStore.getPriceChangeHistory(200)
      });
    }
  );
  app.put(
    "/api/super-admin/pricing",
    authenticateRequest,
    requireSuperAdminPermission("settings:write", true),
    requireRecentReauth,
    (req, res) => {
      const settings = subscriptionStore.updatePlatformSettings({
        updates: req.body || {},
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      res.json({
        settings,
        planPrices: settings.planPrices,
        regionalPlans: settings.regionalPlans,
        priceHistory: subscriptionStore.getPriceChangeHistory(200)
      });
    }
  );
  app.get(
    "/api/super-admin/notifications",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    (req, res) => {
      res.json({ notifications: subscriptionStore.listAdminNotificationsForAdmin() });
    }
  );
  app.post(
    "/api/super-admin/notifications",
    authenticateRequest,
    requireSuperAdminPermission("notifications:send", true),
    (req, res) => {
      const { title, message, type = "info", targetScope = "all", targetUid, targetEmail } = req.body || {};
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
        createdBy: req.authUser.email || req.authUser.uid,
        adminUid: req.authUser.uid,
        ip: getClientIp(req)
      });
      res.status(201).json({ notification });
    }
  );
  app.get(
    "/api/super-admin/support",
    authenticateRequest,
    requireSuperAdminPermission("support:write"),
    async (req, res) => {
      const [feedbacks, incidents] = await Promise.all([
        fetchFirestoreCollectionWithToken("app_feedback", req.authUser.idToken),
        fetchFirestoreCollectionWithToken("incidents", req.authUser.idToken)
      ]);
      res.json({
        tickets: subscriptionStore.listSupportTickets(),
        businessQuotes: subscriptionStore.listBusinessQuotesForAdmin(),
        feedbacks,
        incidentsCount: incidents.length,
        incidents: incidents.slice(0, 50)
      });
    }
  );
  app.post(
    "/api/super-admin/support/:id/reply",
    authenticateRequest,
    requireSuperAdminPermission("support:write"),
    (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { message } = req.body || {};
        if (!message || !String(message).trim()) {
          return res.status(400).json({ error: "Message de r\xE9ponse requis." });
        }
        const ticket = subscriptionStore.replySupportTicket({
          ticketId: id,
          message: String(message),
          senderRole: "admin",
          senderEmail: req.authUser.email || req.authUser.uid,
          adminUid: req.authUser.uid,
          ip: getClientIp(req)
        });
        res.json({ ticket });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.patch(
    "/api/super-admin/support/:id",
    authenticateRequest,
    requireSuperAdminPermission("support:write"),
    (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { status, priority } = req.body;
        const ticket = subscriptionStore.updateSupportTicketStatus({
          ticketId: id,
          status,
          priority,
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid,
          ip: getClientIp(req)
        });
        res.json({ ticket });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.post(
    "/api/super-admin/support/:id/notes",
    authenticateRequest,
    requireSuperAdminPermission("support:write"),
    (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { note } = req.body || {};
        if (!note || !String(note).trim()) {
          return res.status(400).json({ error: "Note interne requise." });
        }
        const ticket = subscriptionStore.addSupportInternalNote({
          ticketId: id,
          note: String(note),
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid
        });
        res.json({ ticket });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.patch(
    "/api/super-admin/business-quotes/:id",
    authenticateRequest,
    requireSuperAdminPermission("support:write"),
    (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const { status, internalNote } = req.body || {};
        const quote = subscriptionStore.updateBusinessQuote({
          id,
          status,
          internalNote,
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid
        });
        res.json({ quote });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.get(
    "/api/super-admin/security",
    authenticateRequest,
    requireSuperAdminPermission("audit:read", true),
    (req, res) => {
      const settings = subscriptionStore.getPlatformSettings();
      const securityEvents = subscriptionStore.listAuditLogs({ category: "security", limit: 100 });
      res.json({
        securitySettings: settings.securitySettings,
        recentSecurityEvents: securityEvents,
        hasAdminIam,
        currentAdmin: {
          uid: req.authUser.uid,
          email: req.authUser.email,
          role: req.authUser.role,
          authTimeMs: req.authUser.authTimeMs
        }
      });
    }
  );
  const apkMulterStorage = import_multer.default.diskStorage({
    destination: (_req, _file, cb) => {
      if (!import_fs4.default.existsSync(APK_TMP_DIR)) {
        import_fs4.default.mkdirSync(APK_TMP_DIR, { recursive: true });
      }
      cb(null, APK_TMP_DIR);
    },
    filename: (_req, file, cb) => {
      const rand = import_crypto3.default.randomBytes(6).toString("hex");
      cb(null, `upload_${Date.now()}_${rand}_${sanitizeApkFileName(file.originalname)}`);
    }
  });
  const handleApkDownloadStream = async (req, res, releaseId, allowUnpublished, source) => {
    try {
      const bin = await subscriptionStore.getAndroidReleaseBinaryForDownload(
        releaseId,
        allowUnpublished
      );
      if (!bin) {
        return res.status(404).json({
          error: "Application Android actuellement indisponible ou version non publi\xE9e.",
          code: "APK_NOT_AVAILABLE"
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
        let eventId = null;
        if (start === 0) {
          const evt2 = subscriptionStore.recordAndroidDownloadInitiated({
            releaseId: bin.release.id,
            source,
            bytesTotal: totalSize,
            country: geo.country
          });
          eventId = evt2?.id || null;
          if (eventId) res.setHeader("X-Download-Event-Id", eventId);
        }
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${totalSize}`);
        res.setHeader("Content-Length", String(chunkSize));
        let bytesSent2 = 0;
        let aborted2 = false;
        const stream2 = import_fs4.default.createReadStream(bin.filePath, { start, end });
        stream2.on("data", (chunk) => {
          bytesSent2 += chunk.length;
        });
        req.on("close", () => {
          if (!res.writableEnded) {
            aborted2 = true;
            stream2.destroy();
            if (eventId) {
              subscriptionStore.markAndroidDownloadFinished(eventId, bytesSent2, "aborted");
            }
          }
        });
        res.on("finish", () => {
          if (eventId && !aborted2 && end >= totalSize - 1 && bytesSent2 >= chunkSize) {
            subscriptionStore.markAndroidDownloadFinished(eventId, totalSize, "completed");
          }
        });
        stream2.on("error", () => {
          if (eventId) {
            subscriptionStore.markAndroidDownloadFinished(eventId, bytesSent2, "aborted");
          }
          if (!res.headersSent) res.status(500).end();
          else res.end();
        });
        return stream2.pipe(res);
      }
      const evt = subscriptionStore.recordAndroidDownloadInitiated({
        releaseId: bin.release.id,
        source,
        bytesTotal: totalSize,
        country: geo.country
      });
      if (evt) {
        res.setHeader("X-Download-Event-Id", evt.id);
      }
      res.setHeader("Content-Length", String(totalSize));
      let bytesSent = 0;
      let aborted = false;
      const stream = import_fs4.default.createReadStream(bin.filePath);
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
      return res.status(500).json({ error: err.message });
    }
  };
  app.get("/api/android-app/latest", (req, res) => {
    const rawCode = req.query.currentVersionCode || req.headers["x-app-version-code"];
    const installedVersionCode = rawCode ? Number(rawCode) : null;
    const latestInfo = subscriptionStore.getLatestPublicAndroidInfo(
      installedVersionCode && Number.isFinite(installedVersionCode) ? installedVersionCode : null
    );
    res.json(latestInfo);
  });
  app.get("/api/android-app/download/latest", async (req, res) => {
    const latest = subscriptionStore.getCurrentPublishedAndroidRelease();
    if (!latest || !subscriptionStore.getAndroidAppSettings().downloadsEnabled) {
      return res.status(404).json({
        error: "Aucune version Android n\u2019est actuellement disponible au t\xE9l\xE9chargement.",
        code: "APK_NOT_AVAILABLE"
      });
    }
    const rawSource = String(req.query.source || "web");
    const source = rawSource === "android_app" || rawSource === "qr" ? rawSource : "web";
    return handleApkDownloadStream(req, res, latest.id, false, source);
  });
  app.get("/api/android-app/download/:id", async (req, res) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const rawSource = String(req.query.source || "web");
    const source = rawSource === "android_app" || rawSource === "qr" ? rawSource : "web";
    return handleApkDownloadStream(req, res, id, false, source);
  });
  app.post("/api/android-app/downloads/:eventId/confirm", (req, res) => {
    const ip = getClientIp(req);
    if (!checkRateLimit(`apk-confirm:${ip}`, 30, 6e4)) {
      return res.status(429).json({ error: "Trop de requ\xEAtes." });
    }
    const eventId = Array.isArray(req.params.eventId) ? req.params.eventId[0] : req.params.eventId;
    const bytesSent = Number(req.body?.bytesSent || 0);
    const updated = subscriptionStore.markAndroidDownloadFinished(
      eventId,
      Number.isFinite(bytesSent) ? bytesSent : 0,
      "completed"
    );
    if (!updated) {
      return res.status(404).json({ error: "\xC9v\xE9nement introuvable." });
    }
    return res.json({ confirmed: true, event: updated });
  });
  app.get(
    "/api/super-admin/android-app/releases",
    authenticateRequest,
    requireSuperAdminPermission("android:read"),
    (_req, res) => {
      res.json({
        releases: subscriptionStore.listAndroidReleases(),
        settings: subscriptionStore.getAndroidAppSettings(),
        stats: subscriptionStore.getAndroidDownloadStats(),
        currentRelease: subscriptionStore.getCurrentPublishedAndroidRelease()
      });
    }
  );
  app.post(
    "/api/super-admin/android-app/releases",
    authenticateRequest,
    requireSuperAdminPermission("android:write"),
    (req, res) => {
      const settings = subscriptionStore.getAndroidAppSettings();
      const uploadMiddleware = (0, import_multer.default)({
        storage: apkMulterStorage,
        limits: {
          fileSize: settings.maxApkSizeBytes || 200 * 1024 * 1024,
          files: 1
        },
        fileFilter: (_r, file, cb) => {
          const clean = import_path4.default.basename(file.originalname || "").toLowerCase();
          if (!clean.endsWith(".apk")) {
            cb(new Error("Seuls les fichiers d'application Android (.apk) sont autoris\xE9s."));
            return;
          }
          cb(null, true);
        }
      }).single("apk");
      uploadMiddleware(req, res, async (uploadErr) => {
        const uploadedFile = req.file;
        const cleanupTemp = () => {
          if (uploadedFile?.path && import_fs4.default.existsSync(uploadedFile.path)) {
            try {
              import_fs4.default.unlinkSync(uploadedFile.path);
            } catch {
            }
          }
        };
        if (uploadErr) {
          cleanupTemp();
          const msg = uploadErr.code === "LIMIT_FILE_SIZE" ? `Fichier trop volumineux (limite maximale : ${Math.round(
            settings.maxApkSizeBytes / (1024 * 1024)
          )} Mo).` : uploadErr.message || "Erreur lors de l'upload du fichier APK.";
          return res.status(400).json({ error: msg });
        }
        if (!uploadedFile) {
          return res.status(400).json({ error: "Veuillez s\xE9lectionner un fichier .apk \xE0 uploader." });
        }
        try {
          const inspection = await validateAndInspectApkFile({
            filePath: uploadedFile.path,
            originalName: uploadedFile.originalname,
            mimeType: uploadedFile.mimetype,
            maxSizeBytes: settings.maxApkSizeBytes,
            storageDir: APK_TMP_DIR
          });
          if (!inspection.valid) {
            cleanupTemp();
            subscriptionStore.recordAuditLog({
              adminUid: req.authUser.uid,
              adminEmail: req.authUser.email || req.authUser.uid,
              adminRole: req.authUser.role,
              action: "ANDROID_APK_UPLOAD_REJECTED",
              category: "android_app",
              outcome: "failed",
              ip: getClientIp(req),
              detail: `Upload APK rejet\xE9 (${uploadedFile.originalname}): ${inspection.error}`
            });
            return res.status(400).json({ error: inspection.error || "Fichier APK invalide." });
          }
          const body = req.body || {};
          const rawWhatsNew = String(body.whatsNew || "");
          let whatsNewList = [];
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
          const status = statusRaw === "draft" || statusRaw === "disabled" ? statusRaw : "published";
          const updateTypeRaw = String(body.updateType || "optional");
          const updateType = updateTypeRaw === "mandatory" ? "mandatory" : "optional";
          const setAsCurrent = body.setAsCurrent === true || body.setAsCurrent === "true" || body.setAsCurrent === "1";
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
            releaseDate: String(body.releaseDate || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)),
            status,
            minAndroidVersion: String(body.minAndroidVersion || "Android 8.0 (API 26)"),
            minAndroidApi: Number(body.minAndroidApi || 26),
            updateType,
            minSupportedVersionCode: body.minSupportedVersionCode ? Number(body.minSupportedVersionCode) : null,
            setAsCurrent,
            adminUid: req.authUser.uid,
            adminEmail: req.authUser.email || req.authUser.uid,
            ip: getClientIp(req)
          });
          return res.status(201).json({
            release: created,
            stats: subscriptionStore.getAndroidDownloadStats(),
            currentRelease: subscriptionStore.getCurrentPublishedAndroidRelease()
          });
        } catch (err) {
          cleanupTemp();
          return res.status(400).json({ error: err.message });
        }
      });
    }
  );
  app.patch(
    "/api/super-admin/android-app/releases/:id",
    authenticateRequest,
    requireSuperAdminPermission("android:write"),
    (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const body = req.body || {};
        const whatsNew = Array.isArray(body.whatsNew) ? body.whatsNew.map((s) => String(s)) : typeof body.whatsNew === "string" ? body.whatsNew.split(/\r?\n/) : void 0;
        const release = subscriptionStore.updateAndroidReleaseMetadata({
          id,
          updates: {
            appName: body.appName,
            versionName: body.versionName,
            description: body.description,
            whatsNew,
            releaseDate: body.releaseDate,
            minAndroidVersion: body.minAndroidVersion,
            minAndroidApi: body.minAndroidApi !== void 0 ? Number(body.minAndroidApi) : void 0,
            updateType: body.updateType,
            minSupportedVersionCode: body.minSupportedVersionCode !== void 0 ? body.minSupportedVersionCode === null || body.minSupportedVersionCode === "" ? null : Number(body.minSupportedVersionCode) : void 0
          },
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid,
          ip: getClientIp(req)
        });
        res.json({
          release,
          currentRelease: subscriptionStore.getCurrentPublishedAndroidRelease()
        });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.post(
    "/api/super-admin/android-app/releases/:id/status",
    authenticateRequest,
    requireSuperAdminPermission("android:write"),
    async (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const action = req.body?.action;
        if (action !== "publish" && action !== "unpublish" && action !== "disable" && action !== "restore") {
          return res.status(400).json({ error: "Action de statut invalide." });
        }
        const release = await subscriptionStore.setAndroidReleaseStatus({
          id,
          action,
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid,
          ip: getClientIp(req)
        });
        res.json({
          release,
          releases: subscriptionStore.listAndroidReleases(),
          currentRelease: subscriptionStore.getCurrentPublishedAndroidRelease(),
          stats: subscriptionStore.getAndroidDownloadStats()
        });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.get(
    "/api/super-admin/android-app/releases/:id/download",
    authenticateRequest,
    requireSuperAdminPermission("android:read"),
    async (req, res) => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      return handleApkDownloadStream(req, res, id, true, "admin");
    }
  );
  app.delete(
    "/api/super-admin/android-app/releases/:id",
    authenticateRequest,
    requireSuperAdminPermission("android:write"),
    (req, res) => {
      try {
        const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
        const confirmRetentionOverride = req.query.force === "true" || req.body?.confirmRetentionOverride === true;
        subscriptionStore.deleteAndroidRelease({
          id,
          confirmRetentionOverride,
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid,
          ip: getClientIp(req)
        });
        res.json({
          deleted: true,
          releases: subscriptionStore.listAndroidReleases(),
          stats: subscriptionStore.getAndroidDownloadStats()
        });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.put(
    "/api/super-admin/android-app/settings",
    authenticateRequest,
    requireSuperAdminPermission("android:write"),
    (req, res) => {
      try {
        const settings = subscriptionStore.updateAndroidAppSettings({
          updates: req.body || {},
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid,
          ip: getClientIp(req)
        });
        res.json({ settings });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.get(
    "/api/super-admin/consents",
    authenticateRequest,
    requireSuperAdminPermission("consent:read"),
    async (req, res) => {
      const fsUsers = await fetchMergedUsersFromFirestore(req.authUser.idToken);
      const overview = subscriptionStore.getAdminConsentsOverview({
        externalFirestoreUsers: fsUsers,
        statusFilter: String(req.query.status || "ALL"),
        platformFilter: String(req.query.platform || "ALL"),
        search: String(req.query.search || "")
      });
      res.json(overview);
    }
  );
  app.get(
    "/api/super-admin/consents/:uid",
    authenticateRequest,
    requireSuperAdminPermission("consent:read"),
    (req, res) => {
      const targetUid = Array.isArray(req.params.uid) ? req.params.uid[0] : req.params.uid;
      const detail = subscriptionStore.getAdminUserConsentDetail(targetUid);
      res.json(detail);
    }
  );
  app.get(
    "/api/admin/subscriptions",
    authenticateRequest,
    requireSuperAdminPermission("users:read"),
    (req, res) => {
      res.json({
        subscriptions: subscriptionStore.listAllSubscriptionsForAdmin(),
        businessQuotes: subscriptionStore.listBusinessQuotesForAdmin(),
        redeemCodes: subscriptionStore.listRedeemCodesForAdmin(),
        activations: subscriptionStore.listRecentActivationsForAdmin(100),
        stats: subscriptionStore.getAdminOverviewStats()
      });
    }
  );
  app.post(
    "/api/admin/early-tester",
    authenticateRequest,
    requireSuperAdminPermission("pioneer:write", true),
    async (req, res) => {
      const { uid, email, note } = req.body || {};
      if (!uid && !email) {
        return res.status(400).json({ error: "uid ou email requis." });
      }
      const updated = subscriptionStore.grantEarlyTester({
        uid,
        email,
        note,
        adminUid: req.authUser.uid,
        adminEmail: req.authUser.email || req.authUser.uid,
        ip: getClientIp(req)
      });
      if (updated) await mirrorSubscriptionToAdminFirestore(updated);
      res.json({ granted: true, subscription: updated });
    }
  );
  app.post(
    "/api/admin/redeem-codes",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req, res) => {
      const { plan, billingCycle = "monthly", count = 1, note } = req.body || {};
      if (plan !== "PREMIUM" && plan !== "FAMILY") {
        return res.status(400).json({ error: "Le plan doit \xEAtre PREMIUM ou FAMILY." });
      }
      if (billingCycle !== "monthly" && billingCycle !== "annual") {
        return res.status(400).json({ error: "Cycle invalide (monthly ou annual)." });
      }
      const codes = subscriptionStore.generateRedeemCodes({
        plan,
        billingCycle,
        count: Number(count) || 1,
        createdBy: req.authUser.email || req.authUser.uid,
        adminUid: req.authUser.uid,
        note,
        ip: getClientIp(req)
      });
      res.status(201).json({
        codes,
        stats: subscriptionStore.getAdminOverviewStats()
      });
    }
  );
  app.post(
    "/api/admin/redeem-codes/:code/revoke",
    authenticateRequest,
    requireSuperAdminPermission("redeem:write"),
    (req, res) => {
      try {
        const rawCode = Array.isArray(req.params.code) ? req.params.code[0] : req.params.code;
        const code = subscriptionStore.updateRedeemCodeStatus({
          idOrCode: rawCode,
          action: "revoke",
          adminUid: req.authUser.uid,
          adminEmail: req.authUser.email || req.authUser.uid,
          ip: getClientIp(req)
        });
        res.json({
          revoked: true,
          code,
          stats: subscriptionStore.getAdminOverviewStats()
        });
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    }
  );
  app.post(
    "/api/ai/generate",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("smart_localization"),
    async (req, res) => {
      try {
        const { prompt, schema } = req.body;
        const { GoogleGenAI } = await import("@google/genai");
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
          return res.status(500).json({ error: "GEMINI_API_KEY is missing." });
        }
        const ai = new GoogleGenAI({ apiKey });
        const config = {};
        if (schema) {
          config.responseMimeType = "application/json";
          config.responseSchema = schema;
        }
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: prompt,
          config
        });
        res.json({ text: response.text });
      } catch (e) {
        const err = e;
        if (err.message?.includes("API key not valid")) {
          console.warn("AI Proxy Warning: Invalid API Key provided.");
          return res.status(401).json({ error: "Invalid API key." });
        }
        console.warn("AI Proxy Error:", err.message);
        res.status(500).json({ error: err.message || "Failed to generate content" });
      }
    }
  );
  app.post(
    "/api/heatmap/query",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("global_risk_heatmap"),
    async (req, res) => {
      try {
        const body = req.body || {};
        if (!body.bounds?.northEast || !body.bounds?.southWest || typeof body.bounds.northEast.lat !== "number" || typeof body.bounds.southWest.lat !== "number") {
          return res.status(400).json({ error: "Param\xE8tres d'emprise g\xE9ographique (bounds) invalides." });
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
            compareEndAt: body.compareEndAt ?? null
          },
          (collectionName) => fetchFirestoreCollectionWithToken(collectionName, req.authUser.idToken)
        );
        res.json(result);
      } catch (err) {
        console.warn("Heatmap query error:", err.message);
        res.status(500).json({ error: err.message || "Erreur lors du calcul de la heatmap." });
      }
    }
  );
  app.post(
    "/api/heatmap/zone-detail",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("global_risk_heatmap"),
    async (req, res) => {
      try {
        const body = req.body || {};
        const lat = Number(body.lat);
        const lng = Number(body.lng);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          return res.status(400).json({ error: "Coordonn\xE9es lat/lng requises." });
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
          compareEndAt: body.compareEndAt ?? null
        });
        res.json(detail);
      } catch (err) {
        res.status(500).json({ error: err.message || "Erreur lors de l'inspection de zone." });
      }
    }
  );
  app.get(
    "/api/heatmap/preferences",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("global_risk_heatmap"),
    (req, res) => {
      const prefs = heatmapStore.getPreferences(req.authUser.uid);
      res.json({ preferences: prefs });
    }
  );
  app.put(
    "/api/heatmap/preferences",
    authenticateRequest,
    requireConsentAccepted,
    requireFeature("global_risk_heatmap"),
    (req, res) => {
      const updated = heatmapStore.savePreferences(req.authUser.uid, req.body || {});
      res.json({ preferences: updated });
    }
  );
  app.post(
    "/api/heatmap/official-alert",
    authenticateRequest,
    requireSuperAdminPermission("settings:write"),
    (req, res) => {
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
          description: String(description || "Alerte officielle publi\xE9e par l'administration VruGuard."),
          source: "OFFICIAL_ALERT",
          sourceLabel: "Alerte Officielle Locale",
          severityScore: score,
          severityTier: severityTierFromScore(score),
          reliability: 0.98,
          confirmations: 1,
          natureWeight: 1.1,
          collectedAt: now,
          lastUpdatedAt: now,
          expiresAt: now + Math.max(1, Number(expiresHours) || 48) * 3600 * 1e3,
          status: "active"
        }
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
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "data=" + encodeURIComponent(req.body.query || req.body.data)
      });
      if (!response.ok) {
        return res.status(response.status).send(await response.text());
      }
      const data = await response.json();
      res.json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path4.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(import_path4.default.join(distPath, "index.html"));
    });
  }
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
