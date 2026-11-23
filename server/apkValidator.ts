import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ALLOWED_APK_MIME_TYPES = new Set([
  'application/vnd.android.package-archive',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'application/java-archive',
  'binary/octet-stream',
]);

const FORBIDDEN_EMBEDDED_EXTENSIONS = ['.exe', '.bat', '.cmd', '.msi', '.vbs', '.ps1', '.scr', '.com'];

export interface ApkInspectionResult {
  valid: boolean;
  fileSize: number;
  sha256: string;
  entriesCount: number;
  hasAndroidManifest: boolean;
  hasDexOrResources: boolean;
  error?: string;
}

export function sanitizeApkFileName(originalName: string): string {
  const base = path.basename(originalName || 'vruguard.apk').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!base.toLowerCase().endsWith('.apk')) {
    return `${base}.apk`;
  }
  return base;
}

export function computeFileSha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', (err) => reject(err));
  });
}

export function getAvailableStorageBytes(targetDir: string): number | null {
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const stat = fs.statfsSync(targetDir);
    return Number(stat.bavail) * Number(stat.bsize);
  } catch {
    return null;
  }
}

/**
 * Inspects a ZIP/APK binary from disk without decompressing full entries:
 * 1. Verifies PK\x03\x04 ZIP header
 * 2. Locates End of Central Directory (0x06054b50)
 * 3. Parses Central Directory filenames to guarantee `AndroidManifest.xml` exists
 * 4. Rejects archives carrying Windows/script executables
 */
function inspectApkZipStructure(filePath: string, fileSize: number): {
  ok: boolean;
  entriesCount: number;
  hasAndroidManifest: boolean;
  hasDexOrResources: boolean;
  error?: string;
} {
  const fd = fs.openSync(filePath, 'r');
  try {
    const header = Buffer.alloc(4);
    const bytesRead = fs.readSync(fd, header, 0, 4, 0);
    if (
      bytesRead < 4 ||
      header[0] !== 0x50 ||
      header[1] !== 0x4b ||
      header[2] !== 0x03 ||
      header[3] !== 0x04
    ) {
      return {
        ok: false,
        entriesCount: 0,
        hasAndroidManifest: false,
        hasDexOrResources: false,
        error: 'Signature binaire invalide : ce fichier n’est pas une archive APK/ZIP authentique.',
      };
    }

    // End of Central Directory can have up to 65535-byte comment + 22 bytes header
    const tailSize = Math.min(fileSize, 65557);
    const tailOffset = fileSize - tailSize;
    const tailBuf = Buffer.alloc(tailSize);
    fs.readSync(fd, tailBuf, 0, tailSize, tailOffset);

    let eocdPos = -1;
    for (let i = tailSize - 22; i >= 0; i--) {
      if (
        tailBuf[i] === 0x50 &&
        tailBuf[i + 1] === 0x4b &&
        tailBuf[i + 2] === 0x05 &&
        tailBuf[i + 3] === 0x06
      ) {
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
        error: 'Structure APK corrompue : répertoire central ZIP introuvable.',
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
        error: 'Table centrale APK invalide ou hors limites.',
      };
    }

    const cdBuf = Buffer.alloc(cdSize);
    fs.readSync(fd, cdBuf, 0, cdSize, cdOffset);

    let cursor = 0;
    let parsedEntries = 0;
    let hasAndroidManifest = false;
    let hasDexOrResources = false;

    while (cursor + 46 <= cdBuf.length && parsedEntries < totalEntries + 1000) {
      if (
        cdBuf[cursor] !== 0x50 ||
        cdBuf[cursor + 1] !== 0x4b ||
        cdBuf[cursor + 2] !== 0x01 ||
        cdBuf[cursor + 3] !== 0x02
      ) {
        break;
      }
      const fileNameLen = cdBuf.readUInt16LE(cursor + 28);
      const extraFieldLen = cdBuf.readUInt16LE(cursor + 30);
      const commentLen = cdBuf.readUInt16LE(cursor + 32);
      const nextCursor = cursor + 46 + fileNameLen + extraFieldLen + commentLen;
      if (nextCursor > cdBuf.length) break;

      const entryName = cdBuf.toString('utf8', cursor + 46, cursor + 46 + fileNameLen);
      const lowerName = entryName.toLowerCase();

      if (lowerName === 'androidmanifest.xml') {
        hasAndroidManifest = true;
      }
      if (
        lowerName === 'classes.dex' ||
        lowerName === 'resources.arsc' ||
        lowerName.startsWith('meta-inf/')
      ) {
        hasDexOrResources = true;
      }
      if (FORBIDDEN_EMBEDDED_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
        return {
          ok: false,
          entriesCount: parsedEntries,
          hasAndroidManifest,
          hasDexOrResources,
          error: `Contenu suspect détecté dans l’archive (${path.basename(entryName)}). Upload bloqué.`,
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
        error:
          'Fichier rejeté : AndroidManifest.xml absent. Seuls les paquets Android (.apk) authentiques sont acceptés.',
      };
    }

    return {
      ok: true,
      entriesCount: parsedEntries,
      hasAndroidManifest,
      hasDexOrResources,
    };
  } finally {
    fs.closeSync(fd);
  }
}

export async function validateAndInspectApkFile(params: {
  filePath: string;
  originalName: string;
  mimeType: string;
  maxSizeBytes: number;
  storageDir: string;
}): Promise<ApkInspectionResult> {
  const cleanName = path.basename(params.originalName || '');
  if (!cleanName.toLowerCase().endsWith('.apk')) {
    return {
      valid: false,
      fileSize: 0,
      sha256: '',
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: 'Extension non autorisée : le fichier doit obligatoirement porter l’extension .apk.',
    };
  }

  const normalizedMime = (params.mimeType || '').toLowerCase().split(';')[0].trim();
  if (normalizedMime && !ALLOWED_APK_MIME_TYPES.has(normalizedMime)) {
    return {
      valid: false,
      fileSize: 0,
      sha256: '',
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: `Type MIME non autorisé (${normalizedMime}).`,
    };
  }

  if (!fs.existsSync(params.filePath)) {
    return {
      valid: false,
      fileSize: 0,
      sha256: '',
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: 'Fichier temporaire introuvable après transfert.',
    };
  }

  const stat = fs.statSync(params.filePath);
  const fileSize = stat.size;
  if (fileSize < 128) {
    return {
      valid: false,
      fileSize,
      sha256: '',
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: 'Fichier APK trop petit ou vide.',
    };
  }
  if (fileSize > params.maxSizeBytes) {
    const maxMb = Math.round(params.maxSizeBytes / (1024 * 1024));
    return {
      valid: false,
      fileSize,
      sha256: '',
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: `Le fichier dépasse la limite maximale autorisée (${maxMb} Mo).`,
    };
  }

  const availBytes = getAvailableStorageBytes(params.storageDir);
  if (availBytes !== null && availBytes < fileSize * 2 + 10 * 1024 * 1024) {
    return {
      valid: false,
      fileSize,
      sha256: '',
      entriesCount: 0,
      hasAndroidManifest: false,
      hasDexOrResources: false,
      error: 'Capacité de stockage serveur insuffisante pour archiver et sauvegarder cet APK.',
    };
  }

  const zipCheck = inspectApkZipStructure(params.filePath, fileSize);
  if (!zipCheck.ok) {
    return {
      valid: false,
      fileSize,
      sha256: '',
      entriesCount: zipCheck.entriesCount,
      hasAndroidManifest: zipCheck.hasAndroidManifest,
      hasDexOrResources: zipCheck.hasDexOrResources,
      error: zipCheck.error,
    };
  }

  const sha256 = await computeFileSha256(params.filePath);

  return {
    valid: true,
    fileSize,
    sha256,
    entriesCount: zipCheck.entriesCount,
    hasAndroidManifest: zipCheck.hasAndroidManifest,
    hasDexOrResources: zipCheck.hasDexOrResources,
  };
}
