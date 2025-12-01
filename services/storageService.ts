import { ScanResult } from '../types';

const STORAGE_KEY = 'math_solver_scans';

export const getScans = (): ScanResult[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Gagal memuat riwayat:", e);
    return [];
  }
};

export const saveScan = (scan: ScanResult): void => {
  const currentScans = getScans();
  // Add new scan to the beginning
  const updatedScans = [scan, ...currentScans];
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedScans));
  } catch (e) {
    console.error("Gagal menyimpan riwayat:", e);
    // Handle quota exceeded if necessary by removing old items, strictly not required for MVP
    if (updatedScans.length > 20) {
        const trimmed = updatedScans.slice(0, 20);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
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
}