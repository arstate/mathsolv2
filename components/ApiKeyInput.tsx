import React, { useState } from 'react';
import { Button } from './Button';
import { clearAllScans } from '../services/storageService';

interface Props {
  onSave: (key: string) => void;
}

export const ApiKeyInput: React.FC<Props> = ({ onSave }) => {
  const [key, setKey] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (key.trim()) onSave(key.trim());
  };

  const handleClearData = () => {
    if (confirm("Apakah anda yakin ingin menghapus semua histori soal? Ini bisa memperbaiki error layar putih.")) {
        clearAllScans();
        alert("Data berhasil dihapus. Silakan coba masukkan API Key lagi.");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100">
        <div className="text-center mb-8">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Selamat Datang</h1>
            <p className="text-gray-500">Masukkan API Key Gemini untuk mengaktifkan kecerdasan buatan.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Google Gemini API Key</label>
                <input 
                    type="text" 
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="Contoh: AIzaSy..."
                    className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    required
                />
            </div>
            
            <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-700 border border-blue-100">
                <p className="mb-2 font-semibold">Belum punya key?</p>
                <p className="mb-2">API Key ini gratis dan milik Anda pribadi.</p>
                <a 
                    href="https://aistudio.google.com/app/apikey" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 underline hover:text-blue-800 font-medium"
                >
                    Dapatkan API Key di sini
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            </div>

            <Button type="submit" fullWidth disabled={!key.trim()}>Mulai Sekarang</Button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-gray-100 text-center">
            <p className="text-xs text-gray-400 mb-3">
                Key akan terhapus otomatis saat refresh halaman.
            </p>
            <button 
                onClick={handleClearData}
                className="text-xs text-red-400 hover:text-red-600 underline"
            >
                Mengalami error layar putih? Hapus Data Histori
            </button>
        </div>
      </div>
    </div>
  );
}