import React, { useEffect, useRef, useState } from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  History,
  Info,
  Radio,
  Satellite,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import {
  ActiveCriticalAlert,
  CriticalAlertCategory,
  CriticalAlertRecord,
  notificationService,
  OrdinaryToastItem,
  ToastVariant,
} from '../services/NotificationService';

interface VruToasterProps {
  onOpenHistory?: () => void;
}

const SWIPE_THRESHOLD_PX = 72;
const SWIPE_VELOCITY_THRESHOLD = 0.35; // px/ms

const VARIANT_META: Record<
  ToastVariant,
  {
    label: string;
    icon: React.FC<{ className?: string }>;
    iconBoxClass: string;
    labelClass: string;
    progressClass: string;
  }
> = {
  success: {
    label: 'Succès',
    icon: CheckCircle2,
    iconBoxClass: 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/25',
    labelClass: 'text-emerald-500',
    progressClass: 'bg-emerald-500/80',
  },
  info: {
    label: 'Information',
    icon: Info,
    iconBoxClass: 'bg-blue-500/15 text-blue-500 border border-blue-500/25',
    labelClass: 'text-blue-500',
    progressClass: 'bg-blue-500/80',
  },
  warning: {
    label: 'Avertissement',
    icon: AlertTriangle,
    iconBoxClass: 'bg-amber-500/15 text-amber-500 border border-amber-500/25',
    labelClass: 'text-amber-500',
    progressClass: 'bg-amber-500/80',
  },
  error: {
    label: 'Erreur',
    icon: AlertOctagon,
    iconBoxClass: 'bg-red-500/15 text-red-500 border border-red-500/25',
    labelClass: 'text-red-500',
    progressClass: 'bg-red-500/80',
  },
};

const CRITICAL_CATEGORY_META: Record<
  CriticalAlertCategory,
  {
    label: string;
    icon: React.FC<{ className?: string }>;
    badgeClass: string;
    borderClass: string;
  }
> = {
  SOS: {
    label: 'Alerte SOS critique',
    icon: ShieldAlert,
    badgeClass: 'bg-red-600 text-[#ffffff]',
    borderClass: 'border-red-500/50',
  },
  EMERGENCY: {
    label: 'Urgence sécurité',
    icon: AlertOctagon,
    badgeClass: 'bg-red-600/20 text-red-400 border border-red-500/35',
    borderClass: 'border-red-500/45',
  },
  GPS_LOSS: {
    label: 'Perte signal GPS',
    icon: Satellite,
    badgeClass: 'bg-amber-500/20 text-amber-400 border border-amber-500/35',
    borderClass: 'border-amber-500/45',
  },
  INCIDENT: {
    label: 'Incident critique',
    icon: Radio,
    badgeClass: 'bg-orange-500/20 text-orange-400 border border-orange-500/35',
    borderClass: 'border-orange-500/45',
  },
  FAMILY: {
    label: 'Sécurité familiale',
    icon: Users,
    badgeClass: 'bg-red-600/20 text-red-400 border border-red-500/35',
    borderClass: 'border-red-500/45',
  },
};

interface SwipeableToastProps {
  item: OrdinaryToastItem;
  prefersReducedMotion: boolean;
}

const SwipeableToastCard: React.FC<SwipeableToastProps> = ({
  item,
  prefersReducedMotion,
}) => {
  const [entered, setEntered] = useState(prefersReducedMotion);
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [swipeExitDir, setSwipeExitDir] = useState<'left' | 'right' | null>(null);

  const pointerStartRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    time: number;
    lockedAxis: 'x' | 'y' | null;
  } | null>(null);

  useEffect(() => {
    if (prefersReducedMotion) {
      setEntered(true);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [prefersReducedMotion]);

  const meta = VARIANT_META[item.variant];
  const IconComp = meta.icon;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Ignore drags starting on interactive buttons/links
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, select')) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    pointerStartRef.current = {
      pointerId: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      time: performance.now(),
      lockedAxis: null,
    };
    notificationService.pauseToast(item.id);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;

    if (!start.lockedAxis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      if (Math.abs(dx) > Math.abs(dy) * 1.15) {
        start.lockedAxis = 'x';
        setIsDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore capture errors on synthetic events
        }
      } else {
        // Vertical scroll intent: release without blocking page scroll
        start.lockedAxis = 'y';
        pointerStartRef.current = null;
        notificationService.resumeToast(item.id);
        return;
      }
    }

    if (start.lockedAxis === 'x') {
      setDragX(dx);
    }
  };

  const finishDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    if (!start || start.pointerId !== e.pointerId) return;

    if (start.lockedAxis === 'x') {
      const dx = e.clientX - start.x;
      const elapsed = Math.max(1, performance.now() - start.time);
      const velocity = Math.abs(dx) / elapsed;

      if (Math.abs(dx) >= SWIPE_THRESHOLD_PX || velocity >= SWIPE_VELOCITY_THRESHOLD) {
        const dir = dx >= 0 ? 'right' : 'left';
        setIsDragging(false);
        setSwipeExitDir(dir);
        pointerStartRef.current = null;

        if (prefersReducedMotion) {
          notificationService.dismiss(item.id, 'swipe');
        } else {
          setTimeout(() => {
            notificationService.dismiss(item.id, 'swipe');
          }, 180);
        }
        return;
      }
    }

    setIsDragging(false);
    setDragX(0);
    pointerStartRef.current = null;
    notificationService.resumeToast(item.id);
  };

  let transformStyle = 'translate3d(0, 0, 0)';
  let opacityStyle = 1;

  if (swipeExitDir) {
    transformStyle = `translate3d(${swipeExitDir === 'right' ? '115%' : '-115%'}, 0, 0)`;
    opacityStyle = 0;
  } else if (isDragging || dragX !== 0) {
    transformStyle = `translate3d(${dragX}px, 0, 0)`;
    opacityStyle = Math.max(0.25, 1 - Math.abs(dragX) / 180);
  } else if (item.exiting) {
    transformStyle = 'translate3d(16px, -6px, 0) scale(0.97)';
    opacityStyle = 0;
  } else if (!entered) {
    transformStyle = 'translate3d(0, 10px, 0) scale(0.98)';
    opacityStyle = 0;
  }

  return (
    <div
      role="status"
      aria-live="off"
      aria-atomic="false"
      onMouseEnter={() => notificationService.pauseToast(item.id)}
      onMouseLeave={() => {
        if (!isDragging) notificationService.resumeToast(item.id);
      }}
      onFocus={() => notificationService.pauseToast(item.id)}
      onBlur={() => notificationService.resumeToast(item.id)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      style={{
        transform: transformStyle,
        opacity: opacityStyle,
        touchAction: 'pan-y',
        transition: isDragging
          ? 'none'
          : prefersReducedMotion
          ? 'none'
          : 'transform 210ms cubic-bezier(0.16, 1, 0.3, 1), opacity 190ms ease',
      }}
      className="pointer-events-auto relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950/95 backdrop-blur-md shadow-[0_12px_32px_-12px_rgba(2,6,23,0.5)] select-none cursor-grab active:cursor-grabbing"
    >
      {item.customRender ? (
        <div className="p-3 pr-9">{item.customRender(item.id)}</div>
      ) : (
        <div className="flex items-start gap-3 p-3.5 pr-10">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.iconBoxClass}`}
            aria-hidden="true"
          >
            <IconComp className="w-4 h-4" />
          </div>

          <div className="flex-1 min-w-0">
            <div className={`text-[11px] font-semibold leading-tight mb-0.5 ${meta.labelClass}`}>
              {meta.label}
            </div>
            <div className="text-[13px] font-medium text-white leading-snug break-words">
              {item.title}
            </div>
            {item.description && (
              <div className="text-xs text-slate-400 leading-snug mt-1 break-words">
                {item.description}
              </div>
            )}
            {item.action && (
              <button
                type="button"
                onClick={() => {
                  item.action?.onClick();
                  notificationService.dismiss(item.id, 'manual');
                }}
                className="mt-2 inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                {item.action.label}
              </button>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          notificationService.dismiss(item.id, 'manual');
        }}
        aria-label="Fermer la notification"
        title="Fermer (Échap)"
        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <X className="w-3.5 h-3.5" />
      </button>

      {Number.isFinite(item.duration) && !item.exiting && !prefersReducedMotion && (
        <div
          aria-hidden="true"
          className="h-[2px] w-full bg-slate-800/60 overflow-hidden"
        >
          <div
            className={`vru-toast-progress h-full origin-left ${meta.progressClass}`}
            style={{
              animationDuration: `${item.duration}ms`,
              animationPlayState: item.paused ? 'paused' : 'running',
            }}
          />
        </div>
      )}
    </div>
  );
};

interface CriticalAlertCardProps {
  alert: ActiveCriticalAlert;
  onConsultOpenModal: (alert: ActiveCriticalAlert) => void;
}

const CriticalAlertCard: React.FC<CriticalAlertCardProps> = ({
  alert,
  onConsultOpenModal,
}) => {
  const meta = CRITICAL_CATEGORY_META[alert.category];
  const IconComp = meta.icon;
  const formattedTime = new Date(alert.createdAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={`pointer-events-auto relative w-full rounded-xl border ${meta.borderClass} bg-slate-950/95 backdrop-blur-md shadow-[0_16px_38px_-12px_rgba(220,38,38,0.45)] p-3.5 pr-10`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${meta.badgeClass}`}
          aria-hidden="true"
        >
          <IconComp className="w-4 h-4" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] font-bold text-red-400 leading-tight mb-1">
            <span>{meta.label}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono tabular-nums text-slate-400 font-medium">
              {formattedTime}
            </span>
          </div>

          <div className="text-[13px] font-semibold text-white leading-snug break-words">
            {alert.title}
          </div>

          {alert.description && (
            <div className="text-xs text-slate-300 leading-snug mt-1 break-words">
              {alert.description}
            </div>
          )}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onConsultOpenModal(alert)}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-[#ffffff] text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              {alert.actionLabel || 'Consulter'}
            </button>
            <button
              type="button"
              onClick={() => notificationService.acknowledgeCriticalAlert(alert.id)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              Acquitter
            </button>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => notificationService.acknowledgeCriticalAlert(alert.id)}
        aria-label="Acquitter et fermer l'alerte critique"
        title="Acquitter l'alerte (conservée dans l'historique)"
        className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};

export const VruToaster: React.FC<VruToasterProps> = ({ onOpenHistory }) => {
  const [toasts, setToasts] = useState<OrdinaryToastItem[]>([]);
  const [criticalAlerts, setCriticalAlerts] = useState<ActiveCriticalAlert[]>([]);
  const [criticalHistory, setCriticalHistory] = useState<CriticalAlertRecord[]>([]);
  const [consultedAlert, setConsultedAlert] = useState<CriticalAlertRecord | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const unsub = notificationService.subscribe((snap) => {
      setToasts(snap.toasts);
      setCriticalAlerts(snap.criticalAlerts);
      setCriticalHistory(snap.criticalHistory);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (consultedAlert) {
          setConsultedAlert(null);
          return;
        }
        notificationService.dismissNewestOrdinary();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [consultedAlert]);

  const handleConsult = (alert: ActiveCriticalAlert) => {
    notificationService.consultCriticalAlert(alert.id);
    if (alert.onConsult) {
      alert.onConsult();
    } else {
      setConsultedAlert(alert);
    }
  };

  return (
    <>
      {/* Desktop unified top-right stack (Critical Alerts on top + max 3 ordinary toasts below) */}
      {(criticalAlerts.length > 0 || toasts.length > 0) && (
        <div
          className="hidden md:flex fixed top-5 right-5 z-[120020] w-[364px] max-w-[calc(100vw-2.5rem)] flex-col gap-2.5 pointer-events-none"
          role="region"
          aria-label="Notifications VruGuard"
          aria-live="off"
        >
          {criticalAlerts.map((alert) => (
            <CriticalAlertCard
              key={alert.id}
              alert={alert}
              onConsultOpenModal={handleConsult}
            />
          ))}

          {toasts.map((item) => (
            <SwipeableToastCard
              key={item.id}
              item={item}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>
      )}

      {/* Mobile Critical Security Alerts: pinned cleanly below the 64px top bar */}
      {criticalAlerts.length > 0 && (
        <div
          className="md:hidden fixed top-[70px] inset-x-3 z-[120020] flex flex-col gap-2 pointer-events-none"
          role="region"
          aria-label="Alertes de sécurité critiques"
        >
          {criticalAlerts.map((alert) => (
            <CriticalAlertCard
              key={alert.id}
              alert={alert}
              onConsultOpenModal={handleConsult}
            />
          ))}
        </div>
      )}

      {/* Mobile Ordinary Toasts: positioned above bottom controls to avoid blocking SOS/Header/Mic */}
      {toasts.length > 0 && (
        <div
          className="md:hidden fixed bottom-[84px] inset-x-3 z-[120015] flex flex-col-reverse gap-2 pointer-events-none"
          role="region"
          aria-label="Notifications temporaires"
          aria-live="off"
        >
          {toasts.map((item) => (
            <SwipeableToastCard
              key={item.id}
              item={item}
              prefersReducedMotion={prefersReducedMotion}
            />
          ))}
        </div>
      )}

      {/* Critical Alert Inspection & Recent History Drawer/Modal */}
      {consultedAlert && (
        <div
          className="fixed inset-0 z-[120050] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vru-critical-modal-title"
          onClick={() => setConsultedAlert(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center gap-2.5">
                <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" />
                <h2
                  id="vru-critical-modal-title"
                  className="text-sm font-bold text-white"
                >
                  Détail de l&apos;alerte de sécurité
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setConsultedAlert(null)}
                aria-label="Fermer le détail de l'alerte"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              <div className="rounded-xl border border-red-500/35 bg-red-950/20 p-4 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-red-400 font-semibold">
                  <span>{CRITICAL_CATEGORY_META[consultedAlert.category].label}</span>
                  <span className="font-mono tabular-nums text-slate-400">
                    {new Date(consultedAlert.createdAt).toLocaleString('fr-FR')}
                  </span>
                </div>
                <p className="text-sm font-semibold text-white">{consultedAlert.title}</p>
                {consultedAlert.description && (
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {consultedAlert.description}
                  </p>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" />
                    Dernières alertes enregistrées
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    {criticalHistory.length} événement(s)
                  </span>
                </div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {criticalHistory.slice(0, 8).map((entry) => (
                    <div
                      key={`${entry.id}-${entry.createdAt}`}
                      className="rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 flex items-start justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-white truncate">
                          {entry.title}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
                          <span>{CRITICAL_CATEGORY_META[entry.category].label}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {new Date(entry.createdAt).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 shrink-0">
                        {entry.acknowledgedAt ? 'Acquittée' : 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="px-5 py-3.5 border-t border-slate-800 bg-slate-900/40 flex items-center justify-end gap-2.5">
              {onOpenHistory && (
                <button
                  type="button"
                  onClick={() => {
                    setConsultedAlert(null);
                    onOpenHistory();
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
                >
                  Ouvrir l&apos;historique complet
                </button>
              )}
              <button
                type="button"
                onClick={() => setConsultedAlert(null)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-[#ffffff] transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
