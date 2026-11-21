import React, { useEffect, useState } from 'react';
import { Accessibility, LifeBuoy, X, Loader2, CheckCircle2, Upload, AlertTriangle } from 'lucide-react';
import { AccessibilityRequestRecord, SupportTicketRecord } from '../types';
import { superAdminService } from '../services/SuperAdminService';
import { toast } from '../services/NotificationService';

interface ModalErrorBoundaryProps {
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

interface ModalErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ModalErrorBoundary extends React.Component<
  ModalErrorBoundaryProps,
  ModalErrorBoundaryState
> {
  declare readonly props: ModalErrorBoundaryProps;
  state: ModalErrorBoundaryState = { hasError: false, errorMessage: '' };
  declare setState: (
    nextState:
      | ModalErrorBoundaryState
      | ((prev: ModalErrorBoundaryState) => ModalErrorBoundaryState)
  ) => void;

  static getDerivedStateFromError(error: Error): ModalErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Erreur inattendue lors de l’affichage du formulaire.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('ModalErrorBoundary caught error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 z-[120000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-slate-900 border border-red-500/40 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>{this.props.title}</span>
              </div>
              <button
                type="button"
                onClick={this.props.onClose}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Fermer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed">{this.state.errorMessage}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, errorMessage: '' })}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
              >
                Réessayer
              </button>
              <button
                type="button"
                onClick={this.props.onClose}
                className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

async function compressImageFileToDataUrl(file: File, maxDataUrlLength = 650000): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Impossible de lire le fichier sélectionné.'));
    reader.readAsDataURL(file);
  });

  if (!file.type.startsWith('image/') || rawDataUrl.length <= maxDataUrlLength) {
    return rawDataUrl;
  }

  return new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const maxDim = 1280;
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.max(1, Math.round(width * ratio));
          height = Math.max(1, Math.round(height * ratio));
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(rawDataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL('image/jpeg', 0.72);
        resolve(compressed.length < rawDataUrl.length ? compressed : rawDataUrl);
      } catch {
        resolve(rawDataUrl);
      }
    };
    img.onerror = () => resolve(rawDataUrl);
    img.src = rawDataUrl;
  });
}

function formatAccessibilityStatusFr(status?: string): string {
  switch (status) {
    case 'approved':
      return 'Approuvé';
    case 'rejected':
      return 'Refusé';
    case 'more_info_required':
      return 'Complément requis';
    default:
      return 'En attente';
  }
}

const AccessibilityApplicationModalInner: React.FC<{
  open: boolean;
  defaultName: string;
  onClose: () => void;
}> = ({ open, defaultName, onClose }) => {
  const [fullName, setFullName] = useState(defaultName || '');
  const [category, setCategory] = useState('Mobilité réduite / Fauteuil roulant');
  const [description, setDescription] = useState('');
  const [docName, setDocName] = useState('');
  const [docMime, setDocMime] = useState('');
  const [docBase64, setDocBase64] = useState<string | undefined>(undefined);
  const [readingFile, setReadingFile] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [myRequests, setMyRequests] = useState<AccessibilityRequestRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setFullName(defaultName || '');
    setLoadError(null);
    setLoadingRequests(true);

    superAdminService
      .getMyAccessibilityApplications()
      .then((res) => {
        if (!active) return;
        const list = Array.isArray(res?.requests) ? res.requests.filter(Boolean) : [];
        setMyRequests(list);
      })
      .catch((err: any) => {
        if (!active) return;
        setMyRequests([]);
        setLoadError(
          err?.message || 'Historique des dossiers temporairement indisponible.'
        );
      })
      .finally(() => {
        if (active) setLoadingRequests(false);
      });

    return () => {
      active = false;
    };
  }, [open, defaultName]);

  if (!open) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error('Le justificatif ne doit pas dépasser 4 Mo.');
      return;
    }
    setReadingFile(true);
    try {
      const dataUrl = await compressImageFileToDataUrl(file);
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      setDocName(file.name || 'justificatif');
      setDocMime(
        dataUrl.startsWith('data:image/jpeg')
          ? 'image/jpeg'
          : file.type || 'application/octet-stream'
      );
      setDocBase64(base64);
    } catch (err: any) {
      toast.error(err?.message || 'Impossible de lire le fichier sélectionné.');
    } finally {
      setReadingFile(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readingFile) {
      toast.info('Préparation du justificatif en cours...');
      return;
    }
    setSubmitting(true);
    try {
      const res = await superAdminService.submitAccessibilityApplication({
        fullName: fullName.trim(),
        disabilityCategory: category,
        description: description.trim(),
        documentName: docName || 'justificatif',
        documentMimeType: docMime || 'application/pdf',
        documentBase64: docBase64,
      });
      if (!res?.request || typeof res.request !== 'object' || !res.request.id) {
        throw new Error('Réponse invalide lors de l’envoi du dossier.');
      }
      setMyRequests((prev) => {
        const existing = Array.isArray(prev) ? prev.filter((item) => item && item.id !== res.request.id) : [];
        return [res.request, ...existing];
      });
      setDescription('');
      setDocName('');
      setDocMime('');
      setDocBase64(undefined);
      toast.success('Demande Accessibilité transmise pour vérification confidentielle.');
    } catch (err: any) {
      toast.error(err?.message || 'Erreur lors de la soumission.');
    } finally {
      setSubmitting(false);
    }
  };

  const safeRequests = Array.isArray(myRequests) ? myRequests.filter(Boolean) : [];

  return (
    <div
      className="fixed inset-0 z-[120000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Accessibility className="w-5 h-5 text-blue-400" />
            <h3 className="font-display text-base font-bold text-white">
              Programme Accessibilité (Premium gratuit à vie)
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          <p className="text-slate-300 leading-relaxed">
            VruGuard offre un accès Premium à vie aux personnes en situation de handicap ou à mobilité réduite. Votre justificatif est stocké de manière strictement confidentielle et uniquement consulté pour validation.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Nom complet *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Situation *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
              >
                <option>Mobilité réduite / Fauteuil roulant</option>
                <option>Déficience visuelle</option>
                <option>Déficience auditive</option>
                <option>Handicap cognitif / Autre</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">
                Précisions sur vos besoins *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Expliquez brièvement votre situation..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">
                Justificatif officiel (PDF, PNG ou JPG, max 4 Mo)
              </label>
              <label className="flex items-center justify-center gap-2 p-3 rounded-xl bg-slate-950 border border-dashed border-slate-700 hover:border-blue-500 cursor-pointer text-slate-300">
                {readingFile ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                ) : (
                  <Upload className="w-4 h-4 text-blue-400" />
                )}
                <span className="truncate">
                  {readingFile ? 'Traitement du fichier...' : docName || 'Choisir un fichier justificatif'}
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || readingFile}
              className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-[#ffffff] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Envoyer ma demande
            </button>
          </form>

          {loadingRequests && (
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Chargement de vos demandes...</span>
            </div>
          )}

          {loadError && !loadingRequests && safeRequests.length === 0 && (
            <div className="pt-3 border-t border-slate-800 text-amber-400/90 text-[11px]">
              {loadError}
            </div>
          )}

          {safeRequests.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="font-semibold text-slate-400">Mes demandes précédentes</div>
              {safeRequests.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex justify-between gap-2"
                >
                  <div>
                    <div className="font-semibold text-white">{r.disabilityCategory}</div>
                    {r.adminComment && (
                      <div className="text-slate-400 mt-0.5">Réponse : {r.adminComment}</div>
                    )}
                  </div>
                  <span
                    className={`font-mono font-semibold shrink-0 ${
                      r.status === 'approved'
                        ? 'text-emerald-400'
                        : r.status === 'rejected'
                        ? 'text-red-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {formatAccessibilityStatusFr(r.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const AccessibilityApplicationModal: React.FC<{
  open: boolean;
  defaultName: string;
  onClose: () => void;
}> = (props) => {
  if (!props.open) return null;
  return (
    <ModalErrorBoundary onClose={props.onClose} title="Programme Accessibilité">
      <AccessibilityApplicationModalInner {...props} />
    </ModalErrorBoundary>
  );
};

const SupportTicketModalInner: React.FC<{
  open: boolean;
  defaultName: string;
  defaultEmail: string;
  onClose: () => void;
}> = ({ open, defaultName, defaultEmail, onClose }) => {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportTicketRecord['category']>('support');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingTickets(true);
    superAdminService
      .getMySupportTickets()
      .then((res) => {
        if (!active) return;
        setTickets(Array.isArray(res?.tickets) ? res.tickets.filter(Boolean) : []);
      })
      .catch(() => {
        if (!active) return;
        setTickets([]);
      })
      .finally(() => {
        if (active) setLoadingTickets(false);
      });
    return () => {
      active = false;
    };
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await superAdminService.submitSupportTicket({
        email: defaultEmail || '',
        name: defaultName || '',
        subject: subject.trim(),
        category,
        message: message.trim(),
      });
      if (!res?.ticket || typeof res.ticket !== 'object' || !res.ticket.id) {
        throw new Error('Réponse invalide lors de l’envoi du ticket.');
      }
      setTickets((prev) => {
        const existing = Array.isArray(prev) ? prev.filter(Boolean) : [];
        return [res.ticket, ...existing];
      });
      setSubject('');
      setMessage('');
      toast.success('Ticket support enregistré.');
    } catch (err: any) {
      toast.error(err?.message || 'Envoi impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  const safeTickets = Array.isArray(tickets) ? tickets.filter(Boolean) : [];

  return (
    <div
      className="fixed inset-0 z-[120000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LifeBuoy className="w-5 h-5 text-emerald-400" />
            <h3 className="font-display text-base font-bold text-white">
              Support &amp; Assistance VruGuard
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-xs">
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-400 mb-1">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none"
                >
                  <option value="support">Assistance</option>
                  <option value="bug">Signalement bug</option>
                  <option value="billing">Abonnement / Redeem</option>
                  <option value="abuse">Signalement abus</option>
                  <option value="other">Autre</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-400 mb-1">Sujet *</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Objet de votre demande"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-400 mb-1">Message *</label>
              <textarea
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Décrivez votre question ou incident..."
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-[#ffffff] font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Envoyer au support
            </button>
          </form>

          {loadingTickets && (
            <div className="pt-3 border-t border-slate-800 flex items-center gap-2 text-slate-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Chargement de vos tickets...</span>
            </div>
          )}

          {safeTickets.length > 0 && (
            <div className="pt-3 border-t border-slate-800 space-y-2.5">
              <div className="font-semibold text-slate-400">Mes tickets récents</div>
              {safeTickets.map((t) => (
                <div
                  key={t.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5"
                >
                  <div className="flex justify-between">
                    <span className="font-semibold text-white">{t.subject}</span>
                    <span className="font-mono text-emerald-400">{t.status}</span>
                  </div>
                  <p className="text-slate-400">{t.message}</p>
                  {(Array.isArray(t.replies) ? t.replies : []).map((r) => (
                    <div
                      key={r.id}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-200 flex items-start gap-1.5"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                      <span>{r.message}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const SupportTicketModal: React.FC<{
  open: boolean;
  defaultName: string;
  defaultEmail: string;
  onClose: () => void;
}> = (props) => {
  if (!props.open) return null;
  return (
    <ModalErrorBoundary onClose={props.onClose} title="Support VruGuard">
      <SupportTicketModalInner {...props} />
    </ModalErrorBoundary>
  );
};
