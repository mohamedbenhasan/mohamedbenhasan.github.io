import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  ShieldCheck,
  Smartphone,
  Sparkles,
  X,
} from 'lucide-react';
import { AndroidLatestVersionResponse } from '../types';
import { androidAppService, formatBytes } from '../services/AndroidAppService';

interface AndroidUpdateModalProps {
  open: boolean;
  latestInfo: AndroidLatestVersionResponse | null;
  installedVersionName?: string;
  installedVersionCode?: number;
  onDismiss?: () => void;
}

export const AndroidUpdateModal: React.FC<AndroidUpdateModalProps> = ({
  open,
  latestInfo,
  installedVersionName = '1.0',
  installedVersionCode = 1,
  onDismiss,
}) => {
  const [downloadStarted, setDownloadStarted] = useState(false);
  const [chunkPct, setChunkPct] = useState<number | null>(null);

  const downloadHref = androidAppService.resolvePublicDownloadUrl(latestInfo, 'android_app');
  const isChunked = androidAppService.isChunkedRelease(latestInfo);

  if (!open || !latestInfo || !latestInfo.available || (!downloadHref && !isChunked)) return null;

  const isMandatory = Boolean(latestInfo.mandatory);

  return (
    <div
      className="fixed inset-0 z-[130000] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      onClick={!isMandatory ? onDismiss : undefined}
    >
      <div
        className={`bg-slate-900 border rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl ${
          isMandatory ? 'border-amber-500/60' : 'border-blue-500/50'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                isMandatory
                  ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400'
                  : 'bg-blue-500/15 border border-blue-500/40 text-blue-400'
              }`}
            >
              {isMandatory ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Smartphone className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                {isMandatory ? 'Mise à jour obligatoire' : 'Nouvelle version disponible'}
              </div>
              <h2 className="font-display text-lg font-bold text-white">
                {latestInfo.appName} v{latestInfo.versionName}
              </h2>
            </div>
          </div>

          {!isMandatory && onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              aria-label="Fermer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {isMandatory && (
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 leading-relaxed">
            {latestInfo.mandatoryReason ||
              'Cette mise à jour est indispensable pour continuer à utiliser VruGuard sur Android.'}
          </div>
        )}

        <div className="grid grid-cols-3 gap-2.5 text-xs tabular-nums">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase font-semibold">Installée</div>
            <div className="text-slate-200 font-mono font-semibold mt-0.5">
              v{installedVersionName} (#{installedVersionCode})
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase font-semibold">Disponible</div>
            <div className="text-emerald-400 font-mono font-bold mt-0.5">
              v{latestInfo.versionName} (#{latestInfo.versionCode})
            </div>
          </div>
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div className="text-slate-500 text-[10px] uppercase font-semibold">Taille</div>
            <div className="text-slate-200 font-mono font-semibold mt-0.5">
              {formatBytes(latestInfo.fileSize)}
            </div>
          </div>
        </div>

        {latestInfo.whatsNew && latestInfo.whatsNew.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              Notes de version
            </div>
            <ul className="space-y-1.5 text-xs text-slate-300 bg-slate-950 border border-slate-800 rounded-xl p-3.5 max-h-40 overflow-y-auto">
              {latestInfo.whatsNew.map((note, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                  <span>{note}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start gap-2.5 text-[11px] text-slate-400 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <span>
            Après téléchargement de l’APK, Android affichera sa fenêtre système de confirmation d’installation (autorisez l’installation depuis cette source si demandé).
          </span>
        </div>

        {downloadStarted && (
          <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              Téléchargement de la mise à jour lancé. Ouvrez le fichier APK depuis votre barre de notifications Android pour installer.
            </span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
          {downloadHref ? (
            <a
              href={downloadHref}
              download={latestInfo.fileName || `VruGuard-v${latestInfo.versionName}.apk`}
              onClick={() => setDownloadStarted(true)}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Télécharger la mise à jour</span>
            </a>
          ) : (
            <button
              type="button"
              disabled={chunkPct !== null}
              onClick={() => {
                if (!latestInfo.releaseId) return;
                setChunkPct(5);
                androidAppService
                  .downloadChunkedApk(
                    latestInfo.releaseId,
                    latestInfo.fileName || `VruGuard-v${latestInfo.versionName}.apk`,
                    (pct) => setChunkPct(pct)
                  )
                  .then(() => {
                    setDownloadStarted(true);
                  })
                  .finally(() => {
                    setChunkPct(null);
                  });
              }}
              className="flex-1 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
            >
              <Download className="w-4 h-4" />
              <span>
                {chunkPct !== null
                  ? `Téléchargement (${chunkPct}%)`
                  : 'Télécharger la mise à jour'}
              </span>
            </button>
          )}

          {!isMandatory && onDismiss && (
            <button
              onClick={onDismiss}
              className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-sm font-semibold transition-colors"
            >
              Plus tard
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
