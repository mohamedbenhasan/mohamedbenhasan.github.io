import fs from 'fs';
import path from 'path';
import assert from 'assert';
import crypto from 'crypto';
import { validateAndInspectApkFile, sanitizeApkFileName } from '../server/apkValidator';
import { subscriptionStore } from '../server/subscriptionStore';

function buildMinimalZipBuffer(entries: Array<{ name: string; content: Buffer }>): Buffer {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const data = entry.content;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const localRecord = Buffer.concat([localHeader, nameBuf, data]);
    localParts.push(localRecord);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(0, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralParts.push(Buffer.concat([centralHeader, nameBuf]));
    offset += localRecord.length;
  }

  const centralDir = Buffer.concat(centralParts);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralDir.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDir, eocd]);
}

async function runTests() {
  const dataDir = path.resolve(process.cwd(), '.data');
  const dbPath = path.join(dataDir, 'subscriptions.json');
  const originalDbExists = fs.existsSync(dbPath);
  const originalDbRaw = originalDbExists ? fs.readFileSync(dbPath, 'utf8') : null;

  const tempDir = fs.mkdtempSync(path.join('/tmp', 'vruguard-apk-test-'));
  const createdReleaseIds: string[] = [];

  try {
    console.log('1) Testing apkValidator security & format checks...');
    assert.strictEqual(sanitizeApkFileName('../../etc/passwd.apk'), 'passwd.apk');
    assert.strictEqual(sanitizeApkFileName('test.exe'), 'test.exe.apk');

    const badTextPath = path.join(tempDir, 'malicious.txt');
    fs.writeFileSync(badTextPath, 'not an apk'.repeat(20));
    const badExtRes = await validateAndInspectApkFile({
      filePath: badTextPath,
      originalName: 'malicious.txt',
      mimeType: 'text/plain',
      maxSizeBytes: 1024 * 1024,
      storageDir: tempDir,
    });
    assert.strictEqual(badExtRes.valid, false);
    assert.match(badExtRes.error || '', /Extension non autorisée/);

    const badMimePath = path.join(tempDir, 'disguised.apk');
    fs.writeFileSync(badMimePath, 'image bytes'.repeat(20));
    const badMimeRes = await validateAndInspectApkFile({
      filePath: badMimePath,
      originalName: 'disguised.apk',
      mimeType: 'image/png',
      maxSizeBytes: 1024 * 1024,
      storageDir: tempDir,
    });
    assert.strictEqual(badMimeRes.valid, false);
    assert.match(badMimeRes.error || '', /Type MIME non autorisé/);

    const fakeZipApkPath = path.join(tempDir, 'fake-plain.apk');
    fs.writeFileSync(
      fakeZipApkPath,
      buildMinimalZipBuffer([{ name: 'README.txt', content: Buffer.from('hello world '.repeat(20)) }])
    );
    const fakeZipRes = await validateAndInspectApkFile({
      filePath: fakeZipApkPath,
      originalName: 'fake-plain.apk',
      mimeType: 'application/vnd.android.package-archive',
      maxSizeBytes: 1024 * 1024,
      storageDir: tempDir,
    });
    assert.strictEqual(fakeZipRes.valid, false);
    assert.match(fakeZipRes.error || '', /AndroidManifest\.xml/);

    const exeApkPath = path.join(tempDir, 'payload.apk');
    fs.writeFileSync(
      exeApkPath,
      buildMinimalZipBuffer([
        { name: 'AndroidManifest.xml', content: Buffer.from('manifest'.repeat(16)) },
        { name: 'assets/malware.exe', content: Buffer.from('MZ'.repeat(32)) },
      ])
    );
    const exeRes = await validateAndInspectApkFile({
      filePath: exeApkPath,
      originalName: 'payload.apk',
      mimeType: 'application/vnd.android.package-archive',
      maxSizeBytes: 1024 * 1024,
      storageDir: tempDir,
    });
    assert.strictEqual(exeRes.valid, false);
    assert.match(exeRes.error || '', /Contenu suspect/);

    const validApkV1Buf = buildMinimalZipBuffer([
      {
        name: 'AndroidManifest.xml',
        content: Buffer.from('<manifest package="com.vruguard.sentinel" versionCode="1"/>'),
      },
      { name: 'classes.dex', content: Buffer.from('dex\n035\0' + 'A'.repeat(256)) },
    ]);
    const validApkV1Path = path.join(tempDir, 'VruGuard-1.0.0.apk');
    fs.writeFileSync(validApkV1Path, validApkV1Buf);
    const inspectedV1 = await validateAndInspectApkFile({
      filePath: validApkV1Path,
      originalName: 'VruGuard-1.0.0.apk',
      mimeType: 'application/vnd.android.package-archive',
      maxSizeBytes: 10 * 1024 * 1024,
      storageDir: tempDir,
    });
    const expectedShaV1 = crypto.createHash('sha256').update(validApkV1Buf).digest('hex');
    assert.strictEqual(inspectedV1.valid, true);
    assert.strictEqual(inspectedV1.sha256, expectedShaV1);
    assert.strictEqual(inspectedV1.hasAndroidManifest, true);
    assert.strictEqual(inspectedV1.hasDexOrResources, true);
    console.log('   ✔ apkValidator passed');

    console.log('2) Testing subscriptionStore APK lifecycle, migrations & integrity...');
    const v1Draft = subscriptionStore.createAndroidRelease({
      tempFilePath: validApkV1Path,
      originalFileName: 'VruGuard-1.0.0.apk',
      fileSize: inspectedV1.fileSize,
      sha256: inspectedV1.sha256,
      mimeType: 'application/vnd.android.package-archive',
      appName: 'VruGuard',
      packageName: 'com.vruguard.sentinel',
      versionName: '1.0.0',
      versionCode: 9001,
      description: 'Version de test V1',
      whatsNew: ['Initialisation test'],
      releaseDate: '2026-11-19',
      status: 'draft',
      minAndroidVersion: 'Android 8.0 (API 26)',
      minAndroidApi: 26,
      updateType: 'optional',
      minSupportedVersionCode: 9001,
      setAsCurrent: false,
      adminUid: 'test_admin',
      adminEmail: 'admin@test.local',
    });
    createdReleaseIds.push(v1Draft.id);

    const beforePublish = subscriptionStore.getLatestPublicAndroidInfo(9000);
    assert.ok(beforePublish.releaseId !== v1Draft.id, 'Draft release must never leak publicly');

    // Publish v1Draft -> becomes current
    const publishedV1 = await subscriptionStore.setAndroidReleaseStatus({
      id: v1Draft.id,
      action: 'publish',
      adminUid: 'test_admin',
      adminEmail: 'admin@test.local',
    });
    assert.strictEqual(publishedV1.status, 'published');
    assert.strictEqual(publishedV1.isCurrent, true);

    const binaryV1 = await subscriptionStore.getAndroidReleaseBinaryForDownload(v1Draft.id);
    assert.ok(binaryV1, 'Published APK binary must be resolvable');
    assert.strictEqual(binaryV1.release.sha256, expectedShaV1);

    // Upload v2 (versionCode 9002) -> replaces current cleanly & preserves v1 backup
    const validApkV2Buf = buildMinimalZipBuffer([
      {
        name: 'AndroidManifest.xml',
        content: Buffer.from('<manifest package="com.vruguard.sentinel" versionCode="2"/>'),
      },
      { name: 'classes.dex', content: Buffer.from('dex\n035\0' + 'B'.repeat(512)) },
    ]);
    const validApkV2Path = path.join(tempDir, 'VruGuard-1.1.0.apk');
    fs.writeFileSync(validApkV2Path, validApkV2Buf);
    const inspectedV2 = await validateAndInspectApkFile({
      filePath: validApkV2Path,
      originalName: 'VruGuard-1.1.0.apk',
      mimeType: 'application/vnd.android.package-archive',
      maxSizeBytes: 10 * 1024 * 1024,
      storageDir: tempDir,
    });
    assert.strictEqual(inspectedV2.valid, true);

    const v2 = subscriptionStore.createAndroidRelease({
      tempFilePath: validApkV2Path,
      originalFileName: 'VruGuard-1.1.0.apk',
      fileSize: inspectedV2.fileSize,
      sha256: inspectedV2.sha256,
      mimeType: 'application/vnd.android.package-archive',
      appName: 'VruGuard',
      packageName: 'com.vruguard.sentinel',
      versionName: '1.1.0',
      versionCode: 9002,
      description: 'Version de test V2',
      whatsNew: ['Correctifs sécurité'],
      releaseDate: '2026-11-19',
      status: 'published',
      minAndroidVersion: 'Android 8.0 (API 26)',
      minAndroidApi: 26,
      updateType: 'optional',
      minSupportedVersionCode: 9002,
      setAsCurrent: true,
      adminUid: 'test_admin',
      adminEmail: 'admin@test.local',
    });
    createdReleaseIds.push(v2.id);

    assert.strictEqual(v2.isCurrent, true);
    const currentAfterV2 = subscriptionStore.getCurrentPublishedAndroidRelease();
    assert.strictEqual(currentAfterV2?.id, v2.id);

    // Duplicate versionCode rejected
    assert.throws(() => {
      subscriptionStore.createAndroidRelease({
        tempFilePath: validApkV2Path,
        originalFileName: 'dup.apk',
        fileSize: 100,
        sha256: 'abc',
        mimeType: 'application/vnd.android.package-archive',
        appName: 'VruGuard',
        versionName: '1.1.1',
        versionCode: 9002,
        description: '',
        whatsNew: [],
        releaseDate: '2026-11-19',
        status: 'draft',
        minAndroidVersion: 'Android 8.0',
        minAndroidApi: 26,
        updateType: 'optional',
        setAsCurrent: false,
        adminUid: 'test_admin',
        adminEmail: 'admin@test.local',
      });
    }, /existe déjà/);

    // Mandatory vs optional update logic
    const checkOld = subscriptionStore.getLatestPublicAndroidInfo(9001);
    assert.strictEqual(checkOld.updateAvailable, true);
    assert.strictEqual(checkOld.mandatory, true);

    const checkUpToDate = subscriptionStore.getLatestPublicAndroidInfo(9002);
    assert.strictEqual(checkUpToDate.updateAvailable, false);
    assert.strictEqual(checkUpToDate.mandatory, false);

    // Disabling global downloads hides availability publicly
    subscriptionStore.updateAndroidAppSettings({
      updates: { downloadsEnabled: false },
      adminUid: 'test_admin',
      adminEmail: 'admin@test.local',
    });
    const whenDisabled = subscriptionStore.getLatestPublicAndroidInfo(9001);
    assert.strictEqual(whenDisabled.available, false);
    assert.strictEqual(whenDisabled.downloadsEnabled, false);
    subscriptionStore.updateAndroidAppSettings({
      updates: { downloadsEnabled: true },
      adminUid: 'test_admin',
      adminEmail: 'admin@test.local',
    });

    // Download initiation vs completion metrics
    const ev1 = subscriptionStore.recordAndroidDownloadInitiated({
      releaseId: v2.id,
      source: 'web',
      bytesTotal: v2.fileSize,
    });
    assert.ok(ev1);
    subscriptionStore.markAndroidDownloadFinished(ev1.id, v2.fileSize, 'completed');

    const ev2 = subscriptionStore.recordAndroidDownloadInitiated({
      releaseId: v2.id,
      source: 'qr',
      bytesTotal: v2.fileSize,
    });
    assert.ok(ev2);
    subscriptionStore.markAndroidDownloadFinished(ev2.id, 12, 'aborted');

    const stats = subscriptionStore.getAndroidDownloadStats();
    const v2Stat = stats.byVersion.find((b) => b.releaseId === v2.id);
    assert.strictEqual(v2Stat?.initiated, 2);
    assert.strictEqual(v2Stat?.completed, 1);

    // Active release deletion blocked
    assert.throws(
      () =>
        subscriptionStore.deleteAndroidRelease({
          id: v2.id,
          adminUid: 'test_admin',
          adminEmail: 'admin@test.local',
        }),
      /impossible de supprimer la version actuellement active/i
    );

    // Published archived release requires unpublishing/disabling before deletion
    assert.throws(
      () =>
        subscriptionStore.deleteAndroidRelease({
          id: v1Draft.id,
          adminUid: 'test_admin',
          adminEmail: 'admin@test.local',
          confirmRetentionOverride: false,
        }),
      /dépubliez ou désactivez/i
    );

    // Unpublish v1Draft -> retention policy still blocks unforced deletion
    await subscriptionStore.setAndroidReleaseStatus({
      id: v1Draft.id,
      action: 'unpublish',
      adminUid: 'test_admin',
      adminEmail: 'admin@test.local',
    });

    assert.throws(
      () =>
        subscriptionStore.deleteAndroidRelease({
          id: v1Draft.id,
          adminUid: 'test_admin',
          adminEmail: 'admin@test.local',
          confirmRetentionOverride: false,
        }),
      /conservation/i
    );

    // Lower minSupportedVersionCode to allow rolling back to v1Draft cleanly
    subscriptionStore.updateAndroidAppSettings({
      updates: { minSupportedVersionCode: 9001 },
      adminUid: 'test_admin',
      adminEmail: 'admin@test.local',
    });

    // Rollback to v1 works cleanly
    const restored = await subscriptionStore.setAndroidReleaseStatus({
      id: v1Draft.id,
      action: 'restore',
      adminUid: 'test_admin',
      adminEmail: 'admin@test.local',
    });
    assert.strictEqual(restored.isCurrent, true);
    console.log('   ✔ subscriptionStore APK lifecycle passed');

    console.log('3) Testing live HTTP security & public endpoints against localhost:3000...');
    const adminResp = await fetch('http://127.0.0.1:3000/api/super-admin/android-app/releases');
    assert.ok(
      adminResp.status === 401 || adminResp.status === 403,
      `Expected 401/403 on unauthenticated super-admin APK route, got ${adminResp.status}`
    );

    const publicLatestResp = await fetch('http://127.0.0.1:3000/api/android-app/latest');
    assert.strictEqual(publicLatestResp.status, 200);
    const publicLatestJson = await publicLatestResp.json();
    assert.strictEqual(typeof publicLatestJson.downloadsEnabled, 'boolean');

    const downloadPageResp = await fetch('http://127.0.0.1:3000/download');
    assert.strictEqual(downloadPageResp.status, 200);

    const adminDeleteResp = await fetch(
      'http://127.0.0.1:3000/api/super-admin/android-app/releases/fake_id',
      { method: 'DELETE' }
    );
    assert.ok(adminDeleteResp.status === 401 || adminDeleteResp.status === 403);
    console.log('   ✔ Live HTTP RBAC & public endpoint checks passed');

    console.log('ALL ANDROID APK DISTRIBUTION TESTS PASSED!');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
    for (const relId of createdReleaseIds) {
      const p1 = path.join(dataDir, 'apk_releases', `${relId}.apk`);
      const p2 = path.join(dataDir, 'apk_backups', `${relId}.bak.apk`);
      if (fs.existsSync(p1)) fs.unlinkSync(p1);
      if (fs.existsSync(p2)) fs.unlinkSync(p2);
    }
    if (originalDbExists && originalDbRaw !== null) {
      fs.writeFileSync(dbPath, originalDbRaw, 'utf8');
    } else if (!originalDbExists && fs.existsSync(dbPath)) {
      fs.unlinkSync(dbPath);
    }
  }
}

runTests().catch((err) => {
  console.error('TEST FAILED:', err);
  process.exit(1);
});
