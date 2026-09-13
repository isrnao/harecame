export interface CameraLayout { primary: string; backup: string; }
export function parseCameraLayout(value: string): CameraLayout {
  try { const data = JSON.parse(value); return { primary: typeof data.primary === 'string' ? data.primary : '', backup: typeof data.backup === 'string' ? data.backup : '' }; }
  catch { return { primary: '', backup: '' }; }
}
export function selectCamera(layout: CameraLayout, available: ReadonlySet<string>) {
  if (available.has(layout.primary)) return layout.primary;
  if (available.has(layout.backup)) return layout.backup;
  return null;
}
