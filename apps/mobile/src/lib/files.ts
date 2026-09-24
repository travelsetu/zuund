import type { FileDto } from '@zuund/shared';
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import type { LocalFile } from './api';
import { tokens } from './tokens';
import { apiFileUrl } from './config';

/** Longest side of an uploaded photo. Plenty for chat and profile photos; keeps uploads quick. */
const MAX_SIDE = 2048;
const WEB_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/**
 * Re-encodes a photo on the device as a real JPEG, at most MAX_SIDE px on its
 * longest side. iPhones store photos as HEIC, which the server (and most
 * browsers) do not accept, and phone photos are often 12–48 MP.
 */
async function toJpeg(
  uri: string,
  width: number | undefined,
  height: number | undefined,
  name: string,
): Promise<LocalFile> {
  const ctx = ImageManipulator.manipulate(uri);
  if (width && height && Math.max(width, height) > MAX_SIDE) {
    ctx.resize(width >= height ? { width: MAX_SIDE } : { height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const out = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.82 });
  return { uri: out.uri, type: 'image/jpeg', name: `${name.replace(/\.\w+$/, '') || 'photo'}.jpg` };
}

/** The server accepts JPEG/PNG/WebP/GIF images and PDFs; it re-checks type, size and magic bytes. */
export async function pickImage(): Promise<LocalFile | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
    // iOS: ask Photos for a compatible (JPEG) rendition rather than the HEIC original.
    preferredAssetRepresentationMode:
      ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  const a = res.canceled ? null : res.assets[0];
  if (!a) return null;
  if (Platform.OS === 'web') {
    // Browsers hand over the original file. iPhone Safari already converts HEIC to JPEG.
    const f = a.file;
    if (!f) return null;
    if (!WEB_IMAGE_TYPES.has(f.type)) throw new UnsupportedImageError();
    return { uri: a.uri, file: f, type: f.type, name: a.fileName ?? f.name };
  }
  return toJpeg(a.uri, a.width, a.height, a.fileName ?? `photo-${Date.now()}`);
}

export async function pickDocument(): Promise<LocalFile | null> {
  const res = await DocumentPicker.getDocumentAsync({
    // HEIC/HEIF are allowed here because they are converted to JPEG below.
    type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
    copyToCacheDirectory: true,
  });
  const a = res.canceled ? null : res.assets[0];
  if (!a) return null;
  const type = a.mimeType ?? 'application/pdf';
  if (Platform.OS !== 'web' && type.startsWith('image/')) {
    return toJpeg(a.uri, undefined, undefined, a.name);
  }
  if (Platform.OS === 'web' && type.startsWith('image/') && !WEB_IMAGE_TYPES.has(type)) {
    throw new UnsupportedImageError();
  }
  return { uri: a.uri, file: a.file, name: a.name, type };
}

/** Thrown for image formats we cannot convert in a browser (e.g. HEIC on desktop Chrome). */
export class UnsupportedImageError extends Error {
  constructor() {
    super('This photo format is not supported. Please choose a JPEG, PNG or WebP image.');
    this.name = 'UnsupportedImageError';
  }
}

/** Files are private (GET /api/files/:id checks access), so download with the token and hand to the OS viewer. */
export async function openFile(f: FileDto): Promise<void> {
  // Web: the session cookie authorises the file URL, so the browser can open it directly.
  if (Platform.OS === 'web') {
    window.open(apiFileUrl(f.url), '_blank', 'noopener');
    return;
  }
  const dir = new Directory(Paths.cache, 'zuund-files');
  if (!dir.exists) dir.create({ intermediates: true });
  const target = new File(dir, `${f.id}-${f.fileName.replace(/[^\w.-]+/g, '_')}`);
  if (!target.exists) {
    await File.downloadFileAsync(apiFileUrl(f.url), target, {
      headers: tokens.access ? { Authorization: `Bearer ${tokens.access}` } : {},
    });
  }
  await Sharing.shareAsync(target.uri, { mimeType: f.mimeType, dialogTitle: f.fileName });
}
