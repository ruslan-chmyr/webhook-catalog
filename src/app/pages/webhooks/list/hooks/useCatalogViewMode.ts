import { useState } from 'react';

export const CATALOG_VIEW_STORAGE_KEY = 'frame50.catalogView';

export type CatalogViewMode = 'table' | 'grid';

export function readCatalogViewMode(): CatalogViewMode {
  try {
    return localStorage.getItem(CATALOG_VIEW_STORAGE_KEY) === 'table' ? 'table' : 'grid';
  } catch {
    return 'grid';
  }
}

export function useCatalogViewMode() {
  const [mode, setModeState] = useState<CatalogViewMode>(readCatalogViewMode);

  const setMode = (next: CatalogViewMode) => {
    setModeState(next);
    try {
      localStorage.setItem(CATALOG_VIEW_STORAGE_KEY, next);
    } catch {
      // The catalog still switches for this visit when storage is unavailable.
    }
  };

  return { mode, setMode };
}
