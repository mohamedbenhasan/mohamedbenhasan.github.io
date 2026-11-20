import React from 'react';

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export type CriticalAlertCategory =
  | 'SOS'
  | 'EMERGENCY'
  | 'GPS_LOSS'
  | 'INCIDENT'
  | 'FAMILY';

export interface ToastOptions {
  id?: string | number;
  description?: React.ReactNode;
  duration?: number;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  onAutoClose?: () => void;
  style?: React.CSSProperties;
  position?: string;
}

export interface CriticalAlertOptions {
  id?: string | number;
  category: CriticalAlertCategory;
  description?: string;
  actionLabel?: string;
  onConsult?: () => void;
  metadata?: {
    lat?: number;
    lng?: number;
    source?: string;
  };
}

export interface OrdinaryToastItem {
  id: string;
  variant: ToastVariant;
  title: React.ReactNode;
  description?: React.ReactNode;
  duration: number;
  createdAt: number;
  exiting: boolean;
  paused: boolean;
  customRender?: (id: string) => React.ReactElement;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
  onAutoClose?: () => void;
}

export interface CriticalAlertRecord {
  id: string;
  category: CriticalAlertCategory;
  title: string;
  description?: string;
  createdAt: number;
  acknowledgedAt?: number;
  consultedAt?: number;
  actionLabel?: string;
  metadata?: {
    lat?: number;
    lng?: number;
    source?: string;
  };
}

export interface ActiveCriticalAlert extends CriticalAlertRecord {
  onConsult?: () => void;
}

export interface NotificationSnapshot {
  toasts: OrdinaryToastItem[];
  criticalAlerts: ActiveCriticalAlert[];
  criticalHistory: CriticalAlertRecord[];
}

export const TOAST_DURATIONS: Record<ToastVariant, number> = {
  success: 3000,
  info: 3000,
  warning: 4000,
  error: 5000,
};

export const MAX_VISIBLE_TOASTS = 3;
const EXIT_ANIMATION_MS = 220;
const DISMISS_COOLDOWN_MS = 6000;
const CRITICAL_HISTORY_STORAGE_KEY = 'vruguard_critical_alerts_v1';
const MAX_HISTORY_RECORDS = 100;

type Listener = (snapshot: NotificationSnapshot) => void;

interface TimerMeta {
  timeoutId: ReturnType<typeof setTimeout>;
  startedAt: number;
  remainingMs: number;
}

class NotificationService {
  private toasts: OrdinaryToastItem[] = [];
  private criticalAlerts: ActiveCriticalAlert[] = [];
  private criticalHistory: CriticalAlertRecord[] = [];
  private listeners = new Set<Listener>();
  private timers = new Map<string, TimerMeta>();
  private exitTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private dismissedCooldowns = new Map<string, number>();
  private counter = 0;

  constructor() {
    this.criticalHistory = this.loadCriticalHistory();
  }

  private loadCriticalHistory(): CriticalAlertRecord[] {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem(CRITICAL_HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, MAX_HISTORY_RECORDS) : [];
    } catch {
      return [];
    }
  }

  private saveCriticalHistory() {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.setItem(
        CRITICAL_HISTORY_STORAGE_KEY,
        JSON.stringify(this.criticalHistory.slice(0, MAX_HISTORY_RECORDS))
      );
    } catch {
      // Ignore storage quota errors cleanly
    }
  }

  private getSnapshot(): NotificationSnapshot {
    return {
      toasts: [...this.toasts],
      criticalAlerts: [...this.criticalAlerts],
      criticalHistory: [...this.criticalHistory],
    };
  }

  private emit() {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.listeners.delete(listener);
    };
  }

  public getCriticalHistory(): CriticalAlertRecord[] {
    return [...this.criticalHistory];
  }

  private nextId(providedId?: string | number): string {
    if (providedId !== undefined && providedId !== null && String(providedId).trim() !== '') {
      return String(providedId);
    }
    this.counter += 1;
    return `vru-toast-${Date.now()}-${this.counter}`;
  }

  private clearTimer(id: string) {
    const meta = this.timers.get(id);
    if (meta) {
      clearTimeout(meta.timeoutId);
      this.timers.delete(id);
    }
  }

  private clearExitTimer(id: string) {
    const exitId = this.exitTimers.get(id);
    if (exitId) {
      clearTimeout(exitId);
      this.exitTimers.delete(id);
    }
  }

  private scheduleAutoClose(id: string, delayMs: number, isAutoClose = true) {
    this.clearTimer(id);
    if (!Number.isFinite(delayMs) || delayMs <= 0) return;

    const startedAt = Date.now();
    const timeoutId = setTimeout(() => {
      this.timers.delete(id);
      this.dismiss(id, isAutoClose ? 'auto' : 'manual');
    }, delayMs);

    this.timers.set(id, {
      timeoutId,
      startedAt,
      remainingMs: delayMs,
    });
  }

  private removeImmediately(id: string) {
    this.clearTimer(id);
    this.clearExitTimer(id);
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.emit();
  }

  public show(
    variant: ToastVariant,
    message: React.ReactNode,
    options?: ToastOptions
  ): string {
    const id = this.nextId(options?.id);
    const now = Date.now();

    // Respect short cooldown when an ID was recently dismissed manually
    if (options?.id !== undefined) {
      const cooldownUntil = this.dismissedCooldowns.get(id);
      if (cooldownUntil && now < cooldownUntil) {
        return id;
      }
      if (cooldownUntil && now >= cooldownUntil) {
        this.dismissedCooldowns.delete(id);
      }
    }

    const defaultDuration = TOAST_DURATIONS[variant];
    // Enforce crisp SaaS toast durations (cap standard toasts to spec unless Infinity)
    const duration =
      options?.duration === Infinity
        ? Infinity
        : options?.duration && options.duration > 0
        ? Math.min(options.duration, defaultDuration)
        : defaultDuration;

    const existingIdx = this.toasts.findIndex((t) => t.id === id);
    if (existingIdx !== -1) {
      // Update existing toast in-place without inflating queue or breaking timers
      const existing = this.toasts[existingIdx];
      this.toasts[existingIdx] = {
        ...existing,
        variant,
        title: message,
        description: options?.description ?? existing.description,
        action: options?.action ?? existing.action,
        exiting: false,
      };
      this.clearExitTimer(id);
      if (!existing.paused && Number.isFinite(duration)) {
        this.scheduleAutoClose(id, duration);
      }
      this.emit();
      return id;
    }

    const item: OrdinaryToastItem = {
      id,
      variant,
      title: message,
      description: options?.description,
      duration,
      createdAt: now,
      exiting: false,
      paused: false,
      action: options?.action,
      onDismiss: options?.onDismiss,
      onAutoClose: options?.onAutoClose,
    };

    // Prepend newest toast first
    this.toasts = [item, ...this.toasts];

    // Enforce MAX_VISIBLE_TOASTS simultaneously visible; purge oldest overflow
    const activeNonExiting = this.toasts.filter((t) => !t.exiting);
    if (activeNonExiting.length > MAX_VISIBLE_TOASTS) {
      const overflow = activeNonExiting.slice(MAX_VISIBLE_TOASTS);
      overflow.forEach((oldToast) => {
        this.clearTimer(oldToast.id);
        this.clearExitTimer(oldToast.id);
        this.toasts = this.toasts.filter((t) => t.id !== oldToast.id);
      });
    }

    if (Number.isFinite(duration)) {
      this.scheduleAutoClose(id, duration);
    }

    this.emit();
    return id;
  }

  public custom(
    renderer: (id: string) => React.ReactElement,
    options?: ToastOptions
  ): string {
    const id = this.nextId(options?.id);
    const duration =
      options?.duration && options.duration > 0
        ? Math.min(options.duration, TOAST_DURATIONS.info)
        : TOAST_DURATIONS.info;

    const item: OrdinaryToastItem = {
      id,
      variant: 'info',
      title: '',
      duration,
      createdAt: Date.now(),
      exiting: false,
      paused: false,
      customRender: renderer,
      onDismiss: options?.onDismiss,
      onAutoClose: options?.onAutoClose,
    };

    this.toasts = [item, ...this.toasts.filter((t) => t.id !== id)];
    if (this.toasts.length > MAX_VISIBLE_TOASTS) {
      const overflow = this.toasts.slice(MAX_VISIBLE_TOASTS);
      overflow.forEach((oldToast) => {
        this.clearTimer(oldToast.id);
        this.clearExitTimer(oldToast.id);
      });
      this.toasts = this.toasts.slice(0, MAX_VISIBLE_TOASTS);
    }

    this.scheduleAutoClose(id, duration);
    this.emit();
    return id;
  }

  public pauseToast(id: string) {
    const target = this.toasts.find((t) => t.id === id);
    if (!target || target.exiting || target.paused) return;

    const meta = this.timers.get(id);
    if (meta) {
      const elapsed = Date.now() - meta.startedAt;
      const remainingMs = Math.max(250, meta.remainingMs - elapsed);
      clearTimeout(meta.timeoutId);
      this.timers.set(id, { ...meta, remainingMs });
    }

    this.toasts = this.toasts.map((t) => (t.id === id ? { ...t, paused: true } : t));
    this.emit();
  }

  public resumeToast(id: string) {
    const target = this.toasts.find((t) => t.id === id);
    if (!target || target.exiting || !target.paused) return;

    const meta = this.timers.get(id);
    const delay = meta ? meta.remainingMs : target.duration;

    this.toasts = this.toasts.map((t) => (t.id === id ? { ...t, paused: false } : t));
    if (Number.isFinite(delay)) {
      this.scheduleAutoClose(id, delay);
    }
    this.emit();
  }

  public dismiss(id?: string | number, reason: 'manual' | 'swipe' | 'auto' = 'manual') {
    if (id === undefined) {
      this.toasts.forEach((t) => {
        this.clearTimer(t.id);
        this.clearExitTimer(t.id);
      });
      this.toasts = [];
      this.emit();
      return;
    }

    const strId = String(id);
    const target = this.toasts.find((t) => t.id === strId);
    if (!target) return;

    this.clearTimer(strId);

    if (reason === 'manual' || reason === 'swipe') {
      this.dismissedCooldowns.set(strId, Date.now() + DISMISS_COOLDOWN_MS);
      target.onDismiss?.();
    } else {
      target.onAutoClose?.();
    }

    // Immediate removal on swipe (already animated out) or reduced motion
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reason === 'swipe' || prefersReducedMotion) {
      this.removeImmediately(strId);
      return;
    }

    if (target.exiting) return;
    this.toasts = this.toasts.map((t) => (t.id === strId ? { ...t, exiting: true } : t));
    this.emit();

    const exitId = setTimeout(() => {
      this.removeImmediately(strId);
    }, EXIT_ANIMATION_MS);
    this.exitTimers.set(strId, exitId);
  }

  public dismissNewestOrdinary() {
    const newest = this.toasts.find((t) => !t.exiting);
    if (newest) {
      this.dismiss(newest.id, 'manual');
    }
  }

  public critical(title: string, options: CriticalAlertOptions): string {
    const id = this.nextId(options.id);
    const now = Date.now();

    // Check if an identical critical alert is already active on screen
    const existingActive = this.criticalAlerts.find((a) => a.id === id);
    if (existingActive) {
      // Update description/title in place without duplicating history spam
      this.criticalAlerts = this.criticalAlerts.map((a) =>
        a.id === id
          ? {
              ...a,
              title,
              description: options.description ?? a.description,
              onConsult: options.onConsult ?? a.onConsult,
            }
          : a
      );
      this.emit();
      return id;
    }

    // Avoid re-opening the exact same alert id within cooldown if just acknowledged
    const cooldownUntil = this.dismissedCooldowns.get(`crit-${id}`);
    if (cooldownUntil && now < cooldownUntil) {
      return id;
    }

    const record: CriticalAlertRecord = {
      id,
      category: options.category,
      title,
      description: options.description,
      createdAt: now,
      actionLabel: options.actionLabel,
      metadata: options.metadata,
    };

    // Always record into persistent history so critical events are never lost
    this.criticalHistory = [
      record,
      ...this.criticalHistory.filter((item) => !(item.id === id && now - item.createdAt < 15000)),
    ].slice(0, MAX_HISTORY_RECORDS);
    this.saveCriticalHistory();

    this.criticalAlerts = [
      { ...record, onConsult: options.onConsult },
      ...this.criticalAlerts,
    ];
    this.emit();
    return id;
  }

  public acknowledgeCriticalAlert(id: string) {
    const now = Date.now();
    this.dismissedCooldowns.set(`crit-${id}`, now + DISMISS_COOLDOWN_MS);
    this.criticalAlerts = this.criticalAlerts.filter((a) => a.id !== id);
    this.criticalHistory = this.criticalHistory.map((item) =>
      item.id === id && !item.acknowledgedAt
        ? { ...item, acknowledgedAt: now }
        : item
    );
    this.saveCriticalHistory();
    this.emit();
  }

  public consultCriticalAlert(id: string) {
    const now = Date.now();
    const target = this.criticalAlerts.find((a) => a.id === id);
    this.dismissedCooldowns.set(`crit-${id}`, now + DISMISS_COOLDOWN_MS);
    this.criticalAlerts = this.criticalAlerts.filter((a) => a.id !== id);
    this.criticalHistory = this.criticalHistory.map((item) =>
      item.id === id
        ? { ...item, consultedAt: now, acknowledgedAt: item.acknowledgedAt || now }
        : item
    );
    this.saveCriticalHistory();
    this.emit();
    target?.onConsult?.();
  }

  public markHistoryConsulted(id: string, createdAt: number) {
    const now = Date.now();
    this.criticalHistory = this.criticalHistory.map((item) =>
      item.id === id && item.createdAt === createdAt
        ? { ...item, consultedAt: now, acknowledgedAt: item.acknowledgedAt || now }
        : item
    );
    this.saveCriticalHistory();
    this.emit();
  }
}

export const notificationService = new NotificationService();

type ToastFn = ((message: React.ReactNode, options?: ToastOptions) => string) & {
  success: (message: React.ReactNode, options?: ToastOptions) => string;
  info: (message: React.ReactNode, options?: ToastOptions) => string;
  warning: (message: React.ReactNode, options?: ToastOptions) => string;
  error: (message: React.ReactNode, options?: ToastOptions) => string;
  critical: (title: string, options: CriticalAlertOptions) => string;
  custom: (renderer: (id: string) => React.ReactElement, options?: ToastOptions) => string;
  dismiss: (id?: string | number) => void;
};

const baseToast = (message: React.ReactNode, options?: ToastOptions): string =>
  notificationService.show('info', message, options);

export const toast: ToastFn = Object.assign(baseToast, {
  success: (message: React.ReactNode, options?: ToastOptions) =>
    notificationService.show('success', message, options),
  info: (message: React.ReactNode, options?: ToastOptions) =>
    notificationService.show('info', message, options),
  warning: (message: React.ReactNode, options?: ToastOptions) =>
    notificationService.show('warning', message, options),
  error: (message: React.ReactNode, options?: ToastOptions) =>
    notificationService.show('error', message, options),
  critical: (title: string, options: CriticalAlertOptions) =>
    notificationService.critical(title, options),
  custom: (renderer: (id: string) => React.ReactElement, options?: ToastOptions) =>
    notificationService.custom(renderer, options),
  dismiss: (id?: string | number) => notificationService.dismiss(id, 'manual'),
});

if (typeof window !== 'undefined') {
  (window as any).toast = toast;
}
