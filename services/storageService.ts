
import { ScanResult, EducationLevel, Subject } from '../types';

const STORAGE_KEY = 'edu_solver_scans';
const PREF_KEY = 'edu_solver_prefs';

export interface UserPreferences {
  level: EducationLevel;
  subject: Subject;
}

// --- Preferences ---

export const saveUserPreferences = (prefs: UserPreferences) => {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
};

export const getUserPreferences = (): UserPreferences => {
  try {
    const stored = localStorage.getItem(PREF_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) { console.error(e); }
  
  // Default values
  return { level: 'Auto', subject: 'Auto' };
};

// --- Scans ---

export const getScans = (): ScanResult[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);

    if (Array.isArray(parsed)) {
      return parsed
        .filter((item) => item !== null && typeof item === 'object')
        .map((item: any) => {
          let fixedImages: string[] = [];
          
          if (Array.isArray(item.images)) {
             fixedImages = item.images;
          } else if (typeof item.imageUrl === 'string') {
             fixedImages = [item.imageUrl];
          }

          return {
             ...item,
             images: fixedImages,
             id: item.id || Date.now().toString() + Math.random().toString(),
             timestamp: item.timestamp || Date.now(),
             // Backward compatibility defaults
             educationLevel: item.educationLevel || 'Auto',
             subject: item.subject || 'Auto'
          };
      });
    }
    return [];
  } catch (e) {
    console.error("Gagal memuat riwayat:", e);
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
};

export const saveScan = (scan: ScanResult): void => {
  try {
    const currentScans = getScans();
    const updatedScans = [scan, ...currentScans].slice(0, 50); // Increased limit slightly
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedScans));
  } catch (e) {
    console.error("Gagal menyimpan riwayat:", e);
    try {
        const minimalScans = [scan];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(minimalScans));
    } catch(err) {}
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
