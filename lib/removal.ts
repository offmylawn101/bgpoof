export type RemovalProgress = { message: string; value: number | null };

// The processing engine is loaded only after a photo is selected.
export async function removePhotoBackground(
  file: File,
  signal: AbortSignal,
  progress: (next: RemovalProgress) => void,
): Promise<Blob> {
  const { processPhoto } = await import('./removal-engine');
  signal.throwIfAborted();
  return processPhoto(file, signal, progress);
}
