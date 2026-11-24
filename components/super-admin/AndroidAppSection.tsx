import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Smartphone,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Eye,
  Edit3,
  Trash2,
  RotateCcw,
  Globe,
  PowerOff,
  FileArchive,
  ShieldCheck,
  Loader2,
  X,
  HardDrive,
  RefreshCw,
  Copy,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  AndroidAppRelease,
  AndroidAppSettings,
  AndroidDownloadStats,
  AndroidReleaseStatus,
  AndroidUpdateType,
} from '../../types';
import { androidAppService, formatBytes } from '../../services/AndroidAppService';
import { toast } from '../../services/NotificationService';
import { formatDateFr, formatDateTimeFr } from './SuperAdminShared';

interface Props {
  refreshTick: number;
  onChanged: () => void;
}

const ANDROID_API_PRESETS = [
  { label: 'Android 7.0 Nougat (API 24)', api: 24 },
  { label: 'Android 8.0 Oreo (API 26)', api: 26 },
  { label: 'Android 9.0 Pie (API 28)', api: 28 },
  { label: 'Android 10 (API 29)', api: 29 },
  { label: 'Android 11 (API 30)', api: 30 },
  { label: 'Android 12 (API 31)', api: 31 },
  { label: 'Android 13 (API 33)', api: 33 },
  { label: 'Android 14 (API 34)', api: 34 },
];

export const AndroidAppSection: React.FC<Props> = ({ refreshTick, onChanged }) => {
  const [releases, setReleases] = useState<AndroidAppRelease[]>([]);
  const [settings, setSettings] = useState<AndroidAppSettings | null>(null);
  const [stats, setStats] = useState<AndroidDownloadStats | null>(null);
  const [currentRelease, setCurrentRelease] = useState<AndroidAppRelease | null>(null);
  const [loading, setLoading] = useState(true);

  // Global settings controls
  const [downloadsEnabled, setDownloadsEnabled] = useState(true);
  const [minSupportedCode, setMinSupportedCode] = useState(1);
  const [retentionKeepCount, setRetentionKeepCount] = useState(3);
  const [appDescription, setAppDescription] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // APK Upload form state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [externalDownloadUrl, setExternalDownloadUrl] = useState('');
  const [appName, setAppName] = useState('VruGuard');
  const [versionName, setVersionName] = useState('');
  const [versionCode, setVersionCode] = useState('');
  const [description, setDescription] = useState('');
  const [whatsNewText, setWhatsNewText] = useState('');
  const [releaseDate, setReleaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [status, setStatus] = useState<AndroidReleaseStatus>('published');
  const [minAndroidApi, setMinAndroidApi] = useState<number>(26);
  const [minAndroidVersion, setMinAndroidVersion] = useState('Android 8.0 Oreo (API 26)');
  const [updateType, setUpdateType] = useState<AndroidUpdateType>('optional');
  const [releaseMinSupportedCode, setReleaseMinSupportedCode] = useState('');
  const [setAsCurrent, setSetAsCurrent] = useState(true);

  const [uploading, setUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadLoadedBytes, setUploadLoadedBytes] = useState(0);
  const [uploadTotalBytes, setUploadTotalBytes] = useState(0);
  const [lastUploadedRelease, setLastUploadedRelease] = useState<AndroidAppRelease | null>(null);

  // Modals (Details, Edit, Delete confirmation)
  const [detailRelease, setDetailRelease] = useState<AndroidAppRelease | null>(null);
  const [editRelease, setEditRelease] = useState<AndroidAppRelease | null>(null);
  const [editForm, setEditForm] = useState<{
    appName: string;
    versionName: string;
    description: string;
    whatsNewText: string;
    releaseDate: string;
    minAndroidVersion: string;
    minAndroidApi: number;
    updateType: AndroidUpdateType;
    minSupportedVersionCode: string;
    externalDownloadUrl: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<AndroidAppRelease | null>(null);
  const [confirmForceRetention, setConfirmForceRetention] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await androidAppService.adminGetReleases();
      setReleases(res.releases);
      setSettings(res.settings);
      setStats(res.stats);
      setCurrentRelease(res.currentRelease);
      setDownloadsEnabled(res.settings.downloadsEnabled);
      setMinSupportedCode(res.settings.minSupportedVersionCode);
      setRetentionKeepCount(res.settings.retentionKeepCount);
      setAppDescription(res.settings.description);
      setAppName((prev) => prev || res.settings.appName || 'VruGuard');

      // Suggest next versionCode automatically if empty
      const maxCode = res.releases.reduce((m, r) => Math.max(m, r.versionCode), 0);
      setVersionCode((prev) => (prev ? prev : String(maxCode + 1)));
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors du chargement des versions Android.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTick]);

  const handleFileSelection = (file: File | null) => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.apk')) {
      toast.error('Fichier rejeté : veuillez sélectionner un paquet Android (.apk).');
      return;
    }
    const maxBytes = settings?.maxApkSizeBytes || 200 * 1024 * 1024;
    if (file.size > maxBytes) {
      toast.error(
        `Le fichier dépasse la taille maximale autorisée (${formatBytes(maxBytes)}).`
      );
      return;
    }
    if (file.size < 128) {
      toast.error('Fichier APK vide ou invalide.');
      return;
    }
    setSelectedFile(file);
    setLastUploadedRelease(null);
  };

  const handleSaveGlobalSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await androidAppService.adminUpdateSettings({
        downloadsEnabled,
        minSupportedVersionCode: Number(minSupportedCode) || 1,
        retentionKeepCount: Number(retentionKeepCount) || 3,
        description: appDescription,
      });
      setSettings(res.settings);
      toast.success('Paramètres de distribution Android enregistrés.');
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de sauvegarder les paramètres.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleDownloadsQuick = async () => {
    const next = !downloadsEnabled;
    setSavingSettings(true);
    try {
      const res = await androidAppService.adminUpdateSettings({ downloadsEnabled: next });
      setDownloadsEnabled(res.settings.downloadsEnabled);
      setSettings(res.settings);
      toast.success(
        next
          ? 'Téléchargement public Android activé.'
          : 'Téléchargement public Android désactivé.'
      );
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la mise à jour.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanExternalUrl = externalDownloadUrl.trim();
    if (!selectedFile && !cleanExternalUrl) {
      toast.error(
        'Veuillez sélectionner un fichier .apk ou saisir un lien de téléchargement APK externe (HTTPS).'
      );
      return;
    }
    if (cleanExternalUrl && !/^https?:\/\/.+/i.test(cleanExternalUrl)) {
      toast.error('Le lien APK externe doit commencer par https:// ou http://.');
      return;
    }
    const parsedCode = Number(versionCode);
    if (!Number.isInteger(parsedCode) || parsedCode < 1) {
      toast.error('Le code de version (versionCode) doit être un entier >= 1.');
      return;
    }
    if (!/^[0-9]+(\.[0-9]+){1,3}(-[a-zA-Z0-9._-]+)?$/.test(versionName.trim())) {
      toast.error('Format de version invalide (ex. 1.0.0 ou 1.2.1).');
      return;
    }

    setUploading(true);
    setUploadPercent(0);
    setUploadLoadedBytes(0);
    setUploadTotalBytes(selectedFile?.size || 0);
    setLastUploadedRelease(null);

    try {
      const res = await androidAppService.adminUploadApk(
        {
          file: selectedFile,
          externalDownloadUrl: cleanExternalUrl || null,
          appName: appName.trim() || 'VruGuard',
          packageName: settings?.packageName || 'com.vruguard.sentinel',
          versionName: versionName.trim(),
          versionCode: parsedCode,
          description: description.trim(),
          whatsNew: whatsNewText,
          releaseDate,
          status,
          minAndroidVersion,
          minAndroidApi,
          updateType,
          minSupportedVersionCode: releaseMinSupportedCode
            ? Number(releaseMinSupportedCode)
            : null,
          setAsCurrent,
        },
        (pct, loaded, total) => {
          setUploadPercent(pct);
          setUploadLoadedBytes(loaded);
          setUploadTotalBytes(total);
        }
      );

      setLastUploadedRelease(res.release);
      toast.success(
        res.release.status === 'published'
          ? `Version v${res.release.versionName} publiée avec succès !`
          : `Brouillon v${res.release.versionName} enregistré.`
      );
      setSelectedFile(null);
      setExternalDownloadUrl('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setVersionName('');
      setVersionCode(String(parsedCode + 1));
      setDescription('');
      setWhatsNewText('');
      await loadData();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Échec de l'upload ou de la validation APK.");
    } finally {
      setUploading(false);
    }
  };

  const handleStatusAction = async (
    rel: AndroidAppRelease,
    action: 'publish' | 'unpublish' | 'disable' | 'restore'
  ) => {
    setBusyRowId(rel.id);
    try {
      const res = await androidAppService.adminChangeReleaseStatus(rel.id, action);
      setReleases(res.releases);
      setCurrentRelease(res.currentRelease);
      setStats(res.stats);
      const actionLabel =
        action === 'publish'
          ? 'publiée'
          : action === 'restore'
          ? 'restaurée comme version courante'
          : action === 'unpublish'
          ? 'basculée en brouillon'
          : 'désactivée';
      toast.success(`Version v${rel.versionName} ${actionLabel}.`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Impossible d'effectuer l'action.");
    } finally {
      setBusyRowId(null);
    }
  };

  const openEditModal = (rel: AndroidAppRelease) => {
    setEditRelease(rel);
    setEditForm({
      appName: rel.appName,
      versionName: rel.versionName,
      description: rel.description,
      whatsNewText: rel.whatsNew.join('\n'),
      releaseDate: rel.releaseDate,
      minAndroidVersion: rel.minAndroidVersion,
      minAndroidApi: rel.minAndroidApi,
      updateType: rel.updateType,
      minSupportedVersionCode: rel.minSupportedVersionCode
        ? String(rel.minSupportedVersionCode)
        : '',
      externalDownloadUrl: rel.externalDownloadUrl || '',
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRelease || !editForm) return;
    setSavingEdit(true);
    try {
      await androidAppService.adminUpdateReleaseMetadata(editRelease.id, {
        appName: editForm.appName,
        versionName: editForm.versionName,
        description: editForm.description,
        whatsNew: editForm.whatsNewText,
        releaseDate: editForm.releaseDate,
        minAndroidVersion: editForm.minAndroidVersion,
        minAndroidApi: editForm.minAndroidApi,
        updateType: editForm.updateType,
        minSupportedVersionCode: editForm.minSupportedVersionCode
          ? Number(editForm.minSupportedVersionCode)
          : null,
        externalDownloadUrl: editForm.externalDownloadUrl.trim() || null,
      });
      toast.success(`Métadonnées de la v${editForm.versionName} mises à jour.`);
      setEditRelease(null);
      setEditForm(null);
      await loadData();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la modification.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await androidAppService.adminDeleteRelease(
        deleteTarget.id,
        confirmForceRetention
      );
      setReleases(res.releases);
      setStats(res.stats);
      toast.success(`Version v${deleteTarget.versionName} supprimée.`);
      setDeleteTarget(null);
      setConfirmForceRetention(false);
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || 'Suppression refusée.');
    } finally {
      setDeleting(false);
    }
  };

  const copySha = (sha: string) => {
    navigator.clipboard.writeText(sha);
    toast.success('Empreinte SHA-256 copiée.');
  };

  const renderStatusLabel = (rel: AndroidAppRelease) => {
    if (rel.status === 'published' && rel.isCurrent) {
      return (
        <span className="text-xs font-semibold text-emerald-400">
          Publiée · Actuelle
        </span>
      );
    }
    if (rel.status === 'published' && !rel.isCurrent) {
      return (
        <span className="text-xs font-semibold text-blue-400">
          Ancienne (Publiée)
        </span>
      );
    }
    if (rel.status === 'draft') {
      return <span className="text-xs font-semibold text-amber-400">Brouillon</span>;
    }
    return <span className="text-xs font-semibold text-slate-400">Désactivée</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header Summary Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center text-blue-400 shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Gestion de l&apos;application Android
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Distribution directe APK sur{' '}
              <span className="font-mono text-slate-300">/download</span> · Version active :{' '}
              <span className="font-mono font-semibold text-emerald-400">
                {currentRelease
                  ? `v${currentRelease.versionName} (code ${currentRelease.versionCode})`
                  : 'Aucune version publiée'}
              </span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={savingSettings}
            onClick={handleToggleDownloadsQuick}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-colors inline-flex items-center gap-2 ${
              downloadsEnabled
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/40'
                : 'bg-red-950/50 border-red-500/40 text-red-300 hover:bg-red-900/40'
            }`}
          >
            <PowerOff className="w-3.5 h-3.5" />
            {downloadsEnabled ? 'Téléchargements actifs' : 'Téléchargements désactivés'}
          </button>

          <a
            href="/download"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <Globe className="w-3.5 h-3.5" />
            Voir page /download
          </a>

          <button
            type="button"
            onClick={loadData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300"
            title="Actualiser"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Download Statistics & Chart */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 tabular-nums">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Total téléchargements</div>
          <div className="font-display text-2xl font-bold text-white mt-1">
            {stats?.totalCompleted ?? 0}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            {stats?.totalInitiated ?? 0} initiés
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Aujourd&apos;hui</div>
          <div className="font-display text-2xl font-bold text-emerald-400 mt-1">
            {stats?.todayCompleted ?? 0}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            {stats?.todayInitiated ?? 0} initiés
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Cette semaine (7j)</div>
          <div className="font-display text-2xl font-bold text-blue-400 mt-1">
            {stats?.weekCompleted ?? 0}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            {stats?.weekInitiated ?? 0} initiés
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-400">Dernier téléchargement</div>
          <div className="font-mono text-sm font-semibold text-white mt-2">
            {stats?.lastDownloadedAt ? formatDateTimeFr(stats.lastDownloadedAt) : 'Aucun'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {releases.length} version{releases.length > 1 ? 's' : ''} stockée
            {releases.length > 1 ? 's' : ''}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 col-span-2 lg:col-span-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-slate-400" />
            Stockage privé APK
          </div>
          <div className="font-display text-xl font-bold text-white mt-1.5">
            {formatBytes(stats?.storageUsedBytes ?? 0)}
          </div>
          <div className="text-[11px] font-mono text-slate-400 mt-1">
            Libre : {formatBytes(stats?.storageAvailableBytes)}
          </div>
        </div>
      </div>

      {/* Evolution Chart + Per-Version Breakdown */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-white">
                Évolution des téléchargements (14 derniers jours)
              </h3>
              <p className="text-xs text-slate-400">
                Distinction entre téléchargements initiés et transferts intégralement terminés.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /> Initiés
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> Terminés
              </span>
            </div>
          </div>
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.dailySeries || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#334155',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="initiated"
                  name="Initiés"
                  stroke="#3b82f6"
                  fill="#3b82f6"
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Terminés"
                  stroke="#10b981"
                  fill="#10b981"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <h3 className="font-display text-sm font-bold text-white mb-1">
            Téléchargements par version
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Répartition terminés / initiés par paquet APK.
          </p>
          <div className="space-y-2.5 overflow-y-auto max-h-56 pr-1">
            {(stats?.byVersion || []).length === 0 ? (
              <div className="text-xs text-slate-500 py-8 text-center">
                Aucune version enregistrée.
              </div>
            ) : (
              stats?.byVersion.map((v) => (
                <div
                  key={v.releaseId}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs tabular-nums"
                >
                  <div>
                    <div className="font-mono font-bold text-white">
                      v{v.versionName}{' '}
                      <span className="text-slate-500 font-normal">({v.versionCode})</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {v.isCurrent ? 'Version active' : v.status}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-emerald-400">
                      {v.completed} terminé{v.completed > 1 ? 's' : ''}
                    </div>
                    <div className="font-mono text-[11px] text-slate-400">
                      {v.initiated} initié{v.initiated > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Upload APK Form + Global Policy */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <form
          onSubmit={handleUploadSubmit}
          className="xl:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="font-display text-base font-bold text-white">
                Uploader et publier un nouveau fichier APK
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Validation binaire ZIP/AndroidManifest.xml, calcul SHA-256 et sauvegarde automatique avant publication.
              </p>
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0] || null;
              handleFileSelection(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
              dragOver
                ? 'border-blue-500 bg-blue-950/20'
                : selectedFile
                ? 'border-emerald-500/50 bg-emerald-950/15'
                : 'border-slate-700 bg-slate-950/60 hover:border-slate-600'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".apk,application/vnd.android.package-archive"
              className="hidden"
              onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
            />
            <div className="flex flex-col items-center gap-2">
              <div className="w-11 h-11 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400">
                <FileArchive className="w-5 h-5" />
              </div>
              {selectedFile ? (
                <>
                  <div className="text-sm font-semibold text-white">{selectedFile.name}</div>
                  <div className="text-xs font-mono text-emerald-400 tabular-nums">
                    Taille détectée : {formatBytes(selectedFile.size)} · Prêt pour vérification
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-slate-200">
                    Glissez un fichier <span className="font-mono text-blue-400">.apk</span> ici ou cliquez pour parcourir
                  </div>
                  <div className="text-xs text-slate-500">
                    Taille max : {formatBytes(settings?.maxApkSizeBytes || 200 * 1024 * 1024)} · Stockage privé sécurisé
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">
              Lien de téléchargement APK externe (optionnel — ex. GitHub Releases)
            </label>
            <input
              type="url"
              placeholder="https://github.com/compte/vruguard/releases/download/v1.0.0/VruGuard.apk"
              value={externalDownloadUrl}
              onChange={(e) => setExternalDownloadUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white outline-none focus:border-blue-500"
            />
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Sans lien externe, le fichier <span className="font-mono">.apk</span> sélectionné est transféré vers Firebase Storage. Avec un lien HTTPS direct (ex. GitHub Releases), vous pouvez déposer le <span className="font-mono">.apk</span> pour calculer automatiquement sa taille et son empreinte SHA-256 sans transfert lourd, ou publier directement via le lien.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Nom de l&apos;application
              </label>
              <input
                type="text"
                required
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Numéro de version (versionName)
              </label>
              <input
                type="text"
                required
                placeholder="Ex. 1.2.0"
                value={versionName}
                onChange={(e) => setVersionName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Code de version (versionCode)
              </label>
              <input
                type="number"
                required
                min={1}
                step={1}
                value={versionCode}
                onChange={(e) => setVersionCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white outline-none focus:border-blue-500 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Taille du fichier
              </label>
              <input
                type="text"
                readOnly
                value={selectedFile ? formatBytes(selectedFile.size) : 'Calcul automatique'}
                className="w-full bg-slate-950/60 border border-slate-800 rounded-xl px-3.5 py-2 text-xs font-mono text-slate-400 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Date de publication
              </label>
              <input
                type="date"
                required
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Statut initial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as AndroidReleaseStatus)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-blue-500"
              >
                <option value="published">Publié</option>
                <option value="draft">Brouillon</option>
                <option value="disabled">Désactivé</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Version minimale Android requise
              </label>
              <select
                value={minAndroidApi}
                onChange={(e) => {
                  const api = Number(e.target.value);
                  setMinAndroidApi(api);
                  const preset = ANDROID_API_PRESETS.find((p) => p.api === api);
                  if (preset) setMinAndroidVersion(preset.label);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-blue-500"
              >
                {ANDROID_API_PRESETS.map((p) => (
                  <option key={p.api} value={p.api}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Type de mise à jour
              </label>
              <select
                value={updateType}
                onChange={(e) => setUpdateType(e.target.value as AndroidUpdateType)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-blue-500"
              >
                <option value="optional">Facultative (notification utilisateur)</option>
                <option value="mandatory">Obligatoire (blocage si incompatible)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Seuil minSupportedCode (optionnel)
              </label>
              <input
                type="number"
                min={1}
                placeholder="Ex. 2 (force mise à jour < 2)"
                value={releaseMinSupportedCode}
                onChange={(e) => setReleaseMinSupportedCode(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white outline-none focus:border-blue-500 tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Description de la version
              </label>
              <textarea
                rows={4}
                placeholder="Résumé technique et objectifs de cette mise à jour..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5">
                Liste des nouveautés (What&apos;s New — 1 ligne par point)
              </label>
              <textarea
                rows={4}
                placeholder={'Amélioration précision GPS hors-ligne\nCorrection alerte SOS vocale\nOptimisation batterie'}
                value={whatsNewText}
                onChange={(e) => setWhatsNewText(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-800">
            <label className="inline-flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={setAsCurrent}
                onChange={(e) => setSetAsCurrent(e.target.checked)}
                disabled={status !== 'published'}
                className="rounded border-slate-600 bg-slate-950 text-blue-600"
              />
              <span>
                Définir comme dernière version publique (remplace l’ancienne sur /download sans la supprimer)
              </span>
            </label>

            <button
              type="submit"
              disabled={uploading || (!selectedFile && !externalDownloadUrl.trim())}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50 transition-colors"
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" />
              )}
              {status === 'published' ? 'Publier la mise à jour' : 'Enregistrer la version'}
            </button>
          </div>

          {/* Upload progress bar */}
          {uploading && (
            <div className="p-4 rounded-xl bg-slate-950 border border-blue-500/40 space-y-2 tabular-nums">
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-300 font-semibold">
                  Transfert et vérification cryptographique SHA-256 en cours...
                </span>
                <span className="font-mono text-white font-bold">{uploadPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-150"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                {formatBytes(uploadLoadedBytes)} / {formatBytes(uploadTotalBytes)}
              </div>
            </div>
          )}

          {/* Post-upload confirmation */}
          {lastUploadedRelease && (
            <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-xs space-y-1.5">
              <div className="flex items-center gap-2 font-semibold text-emerald-300">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  APK v{lastUploadedRelease.versionName} (code {lastUploadedRelease.versionCode}) vérifié et stocké avec succès !
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-300 break-all">
                ID : {lastUploadedRelease.id} · SHA-256 : {lastUploadedRelease.sha256}
              </div>
            </div>
          )}
        </form>

        {/* Global Security & Retention Settings */}
        <form
          onSubmit={handleSaveGlobalSettings}
          className="xl:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="font-display text-sm font-bold text-white">
              Politique &amp; Règles de conservation
            </h3>
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-white">Téléchargement public actif</div>
              <div className="text-[11px] text-slate-400">
                Autoriser /download et /api/android-app/latest
              </div>
            </div>
            <input
              type="checkbox"
              checked={downloadsEnabled}
              onChange={(e) => setDownloadsEnabled(e.target.checked)}
              className="rounded border-slate-600 bg-slate-900 text-emerald-500"
            />
          </label>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              VersionCode minimal compatible (sécurité)
            </label>
            <input
              type="number"
              min={1}
              value={minSupportedCode}
              onChange={(e) => setMinSupportedCode(Number(e.target.value) || 1)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white outline-none focus:border-blue-500 tabular-nums"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Toute app installée en dessous de ce code recevra une mise à jour obligatoire.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Versions récentes protégées contre suppression
            </label>
            <input
              type="number"
              min={1}
              max={20}
              value={retentionKeepCount}
              onChange={(e) => setRetentionKeepCount(Number(e.target.value) || 3)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-mono text-white outline-none focus:border-blue-500 tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-400 mb-1.5">
              Description publique de l&apos;application
            </label>
            <textarea
              rows={3}
              value={appDescription}
              onChange={(e) => setAppDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {savingSettings && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Enregistrer les règles
          </button>
        </form>
      </div>

      {/* Version History Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-bold text-white">
              Historique des versions Android
            </h3>
            <p className="text-xs text-slate-400">
              Toutes les versions APK sont archivées avec sauvegarde pour restauration immédiate sans perte de données.
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400 tabular-nums">
            {releases.length} version{releases.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 border-b border-slate-800 text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 font-semibold">Version</th>
                <th className="py-3 px-4 font-semibold">Code</th>
                <th className="py-3 px-4 font-semibold">Date</th>
                <th className="py-3 px-4 font-semibold">Statut</th>
                <th className="py-3 px-4 font-semibold">Taille / Type</th>
                <th className="py-3 px-4 font-semibold">Téléchargements</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {releases.map((rel) => {
                const isBusy = busyRowId === rel.id;
                return (
                  <tr key={rel.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-white">{rel.versionName}</div>
                      <div className="text-[11px] text-slate-400">{rel.minAndroidVersion}</div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-200 tabular-nums">
                      {rel.versionCode}
                    </td>
                    <td className="py-3 px-4 text-slate-300 tabular-nums">
                      {rel.releaseDate || formatDateFr(rel.createdAt)}
                    </td>
                    <td className="py-3 px-4">{renderStatusLabel(rel)}</td>
                    <td className="py-3 px-4 tabular-nums">
                      <div className="font-mono text-slate-200">{formatBytes(rel.fileSize)}</div>
                      <div className="text-[11px] text-slate-400">
                        {rel.updateType === 'mandatory' ? 'Obligatoire' : 'Facultative'}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono tabular-nums">
                      <span className="text-emerald-400 font-semibold">
                        {rel.downloadsCompleted}
                      </span>{' '}
                      <span className="text-slate-500">/ {rel.downloadsInitiated}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-end gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setDetailRelease(rel)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 inline-flex items-center gap-1"
                          title="Détails"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Détails</span>
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            androidAppService
                              .adminDownloadRelease(
                                rel.id,
                                rel.versionName,
                                rel.externalDownloadUrl
                              )
                              .catch((err) => toast.error(err.message))
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 inline-flex items-center gap-1"
                          title="Télécharger l'APK"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(rel)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 inline-flex items-center gap-1"
                          title="Modifier les informations"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Modifier</span>
                        </button>

                        {!rel.isCurrent && rel.status === 'draft' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusAction(rel, 'publish')}
                            className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                          >
                            Publier
                          </button>
                        )}

                        {!rel.isCurrent && rel.status !== 'draft' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusAction(rel, 'restore')}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[#ffffff] font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                            title="Restaurer comme version courante"
                          >
                            <RotateCcw className="w-3 h-3" />
                            Restaurer
                          </button>
                        )}

                        {rel.status === 'published' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusAction(rel, 'unpublish')}
                            className="px-2.5 py-1.5 rounded-lg bg-amber-950/60 hover:bg-amber-900/60 border border-amber-500/40 text-amber-300 font-semibold disabled:opacity-50"
                          >
                            Dépublier
                          </button>
                        )}

                        {rel.status !== 'disabled' && (
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleStatusAction(rel, 'disable')}
                            className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-red-950/50 border border-slate-700 hover:border-red-500/40 text-slate-300 hover:text-red-300 disabled:opacity-50"
                          >
                            Désactiver
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={rel.isCurrent || rel.status === 'published'}
                          onClick={() => {
                            setDeleteTarget(rel);
                            setConfirmForceRetention(false);
                          }}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950/60 border border-slate-700 hover:border-red-500/40 text-slate-400 hover:text-red-300 disabled:opacity-35 disabled:cursor-not-allowed"
                          title={
                            rel.isCurrent || rel.status === 'published'
                              ? 'Dépubliez avant de supprimer'
                              : 'Supprimer définitivement'
                          }
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {releases.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-slate-500">
                    Aucune version APK uploadée pour le moment. Utilisez le formulaire ci-dessus pour publier votre première version Android.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Details Modal */}
      {detailRelease && (
        <div
          className="fixed inset-0 z-[130000] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-display text-base font-bold text-white">
                  {detailRelease.appName} v{detailRelease.versionName} (Code {detailRelease.versionCode})
                </h3>
                <div className="mt-1">{renderStatusLabel(detailRelease)}</div>
              </div>
              <button
                onClick={() => setDetailRelease(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3 tabular-nums">
                <div>
                  <span className="text-slate-500 block">Fichier</span>
                  <span className="text-slate-200 font-mono break-all">{detailRelease.fileName}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Taille</span>
                  <span className="text-slate-200 font-mono">{formatBytes(detailRelease.fileSize)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Android minimum</span>
                  <span className="text-slate-200">{detailRelease.minAndroidVersion}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Sauvegarde / Fichier</span>
                  <span className="text-emerald-400 font-semibold">
                    {detailRelease.fileAvailable ? 'Intègre' : 'Manquant'} ·{' '}
                    {detailRelease.hasBackup ? 'Backup OK' : 'Sans backup'}
                  </span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Empreinte SHA-256</span>
                  <button
                    type="button"
                    onClick={() => copySha(detailRelease.sha256)}
                    className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" /> Copier
                  </button>
                </div>
                <div className="font-mono text-[11px] text-slate-300 break-all">
                  {detailRelease.sha256 || 'Non calculé (publication par lien externe)'}
                </div>
              </div>

              {detailRelease.externalDownloadUrl && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1">
                  <span className="text-slate-500 block">
                    URL de téléchargement ({detailRelease.storagePath ? 'Firebase Storage' : 'Lien externe'})
                  </span>
                  <a
                    href={detailRelease.externalDownloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[11px] text-blue-400 hover:underline break-all"
                  >
                    {detailRelease.externalDownloadUrl}
                  </a>
                </div>
              )}

              {detailRelease.description && (
                <div>
                  <div className="text-slate-400 font-semibold mb-1">Description</div>
                  <p className="text-slate-300 leading-relaxed">{detailRelease.description}</p>
                </div>
              )}

              {detailRelease.whatsNew.length > 0 && (
                <div>
                  <div className="text-slate-400 font-semibold mb-1">Nouveautés (What&apos;s New)</div>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {detailRelease.whatsNew.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="text-[11px] text-slate-500 pt-1">
                Uploadé par {detailRelease.uploadedByEmail} le {formatDateTimeFr(detailRelease.createdAt)}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDetailRelease(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editRelease && editForm && (
        <div
          className="fixed inset-0 z-[130000] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleSaveEdit}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-display text-base font-bold text-white">
                Modifier v{editRelease.versionName} (Code {editRelease.versionCode})
              </h3>
              <button
                type="button"
                onClick={() => {
                  setEditRelease(null);
                  setEditForm(null);
                }}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Nom de l&apos;application</label>
                <input
                  type="text"
                  required
                  value={editForm.appName}
                  onChange={(e) => setEditForm({ ...editForm, appName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Numéro de version</label>
                <input
                  type="text"
                  required
                  value={editForm.versionName}
                  onChange={(e) => setEditForm({ ...editForm, versionName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Date de publication</label>
                <input
                  type="date"
                  required
                  value={editForm.releaseDate}
                  onChange={(e) => setEditForm({ ...editForm, releaseDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type de mise à jour</label>
                <select
                  value={editForm.updateType}
                  onChange={(e) =>
                    setEditForm({ ...editForm, updateType: e.target.value as AndroidUpdateType })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                >
                  <option value="optional">Facultative</option>
                  <option value="mandatory">Obligatoire</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <textarea
                rows={3}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Lien de téléchargement APK direct (HTTPS)
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={editForm.externalDownloadUrl}
                onChange={(e) =>
                  setEditForm({ ...editForm, externalDownloadUrl: e.target.value })
                }
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Nouveautés (1 ligne par point)
              </label>
              <textarea
                rows={4}
                value={editForm.whatsNewText}
                onChange={(e) => setEditForm({ ...editForm, whatsNewText: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setEditRelease(null);
                  setEditForm(null);
                }}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
              >
                {savingEdit && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-[130000] bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5 text-red-400">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <h3 className="font-display text-base font-bold text-white">
                Supprimer la version v{deleteTarget.versionName} ?
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Cette action supprimera le fichier APK (code {deleteTarget.versionCode}) et sa sauvegarde du stockage serveur. Elle est irréversible.
            </p>
            <label className="flex items-start gap-2 text-xs text-amber-300 bg-amber-950/30 border border-amber-500/30 rounded-xl p-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmForceRetention}
                onChange={(e) => setConfirmForceRetention(e.target.checked)}
                className="mt-0.5 rounded border-slate-600 bg-slate-950 text-amber-500"
              />
              <span>
                Je confirme la suppression même si cette version est couverte par la règle de conservation ({retentionKeepCount} dernières versions).
              </span>
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-[#ffffff] text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Supprimer définitivement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
