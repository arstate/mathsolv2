import { ScanResult } from '../types';

const STORAGE_KEY = 'math_solver_scans';

export const getScans = (): ScanResult[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);

    if (Array.isArray(parsed)) {
      // Filter out nulls and fix structure
      return parsed
        .filter((item) => item !== null && typeof item === 'object')
        .map((item: any) => {
          // Force 'images' to be an array
          let fixedImages: string[] = [];
          
          if (Array.isArray(item.images)) {
             fixedImages = item.images;
          } else if (typeof item.imageUrl === 'string') {
             fixedImages = [item.imageUrl]; // Migrate old single image
          }

          return {
             ...item,
             images: fixedImages,
             // Ensure ID exists
             id: item.id || Date.now().toString() + Math.random().toString(),
             timestamp: item.timestamp || Date.now()
          };
      });
    }
    return [];
  } catch (e) {
    console.error("Gagal memuat riwayat (Data Corrupt):", e);
    // Auto-clear corrupt data to fix white screen loop
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
};

export const saveScan = (scan: ScanResult): void => {
  try {
    const currentScans = getScans();
    const updatedScans = [scan, ...currentScans].slice(0, 30); // Limit to 30 items
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedScans));
  } catch (e) {
    console.error("Gagal menyimpan riwayat:", e);
    // If quota exceeded, try clearing old data
    try {
        const minimalScans = [scan];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalScans));
    } catch(err) {
        console.error("Critical storage failure");
    }
  }
};

export const updateScan = (id: string, updates: Partial<ScanResult>): void => {
  const currentScans = getScans();
  const index = currentScans.findIndex(s => s.id === id);
  if (index !== -1) {
    currentScans[index] = { ...currentScans[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(currentScans));
  }
};

export const deleteScan = (id: string): void => {
    const currentScans = getScans();
    const updated = currentScans.filter(s => s.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
};

export const clearAllScans = (): void => {
    localStorage.removeItem(STORAGE_KEY);
};