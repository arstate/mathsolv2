import React, { useState, useEffect, useRef } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { Button } from './components/Button';
import { ApiKeyInput } from './components/ApiKeyInput';
import { CropModal } from './components/CropModal';
import { TextInputModal } from './components/TextInputModal';
import { ScanResult, ViewState, ExplanationStyle } from './types';
import { getScans, saveScan, updateScan, deleteScan } from './services/storageService';
import { solveMathProblem } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.LIST);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [selectedScan, setSelectedScan] = useState<ScanResult | null>(null);
  
  // Staging State (New Feature)
  const [stagingImages, setStagingImages] = useState<string[]>([]);
  const [stagingTexts, setStagingTexts] = useState<string[]>([]); // New state for text
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
  const [showTextModal, setShowTextModal] = useState(false); // Modal visibility
  
  const [explanationStyle, setExplanationStyle] = useState<ExplanationStyle>('detailed');
  
  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // API Key State (Temporary / Session Only)
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    // Hanya memuat riwayat soal, TIDAK memuat API Key dari storage
    setScans(getScans());
  }, []);

  const handleSaveKey = (key: string) => {
    // Simpan ke state saja (hilang saat refresh)
    setApiKey(key);
  };

  const handleResetKey = () => {
    if (confirm("Reset API Key untuk sesi ini?")) {
        setApiKey(null);
        setView(ViewState.LIST);
    }
  };

  const handleCheckPermissions = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        // Jika berhasil, hentikan stream segera
        stream.getTracks().forEach(track => track.stop());
        alert("✅ Izin Kamera Aktif!\n\nSistem siap digunakan untuk memindai soal.");
    } catch (err) {
        console.error(err);
        alert("⚠️ Akses Kamera Ditolak atau Tidak Ditemukan.\n\nMohon izinkan akses kamera melalui pengaturan situs di browser Anda (biasanya ikon gembok di sebelah URL).");
    }
  };

  // --- Capture & Upload Flow ---

  const startNewSession = () => {
    setStagingImages([]);
    setStagingTexts([]);
    setExplanationStyle('detailed');
    setView(ViewState.STAGING);
  };

  const handleCameraCapture = (imageData: string) => {
    // Go to crop instead of direct solve
    setTempImageForCrop(imageData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
           setTempImageForCrop(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropConfirm = (croppedData: string) => {
    // Add to staging
    if (stagingImages.length >= 10) { // Limit reasonable amount
        alert("Maksimal 10 gambar per sesi.");
        return;
    }
    setStagingImages(prev => [...prev, croppedData]);
    setTempImageForCrop(null);
    setView(ViewState.STAGING); // Ensure we are back in staging
  };

  const removeStagingImage = (index: number) => {
    setStagingImages(prev => prev.filter((_, i) => i !== index));
  };

  // --- Text Input Logic ---

  const handleAddText = (text: string) => {
    setStagingTexts(prev => [...prev, text]);
    setShowTextModal(false);
  };

  const removeStagingText = (index: number) => {
    setStagingTexts(prev => prev.filter((_, i) => i !== index));
  };

  // --- Solving Logic ---

  const handleProcessStaging = async () => {
    if (!apiKey) return;
    if (stagingImages.length === 0 && stagingTexts.length === 0) {
        alert("Mohon masukkan minimal satu gambar atau satu teks soal.");
        return;
    }

    const newId = Date.now().toString();
    const newScan: ScanResult = {
      id: newId,
      timestamp: Date.now(),
      images: stagingImages,
      textInputs: stagingTexts,
      explanationStyle,
      loading: true,
    };

    saveScan(newScan);
    setScans(prev => [newScan, ...prev]);
    setSelectedScan(newScan);
    setView(ViewState.SOLUTION);

    try {
      const solution = await solveMathProblem(stagingImages, stagingTexts, apiKey, explanationStyle);
      const updates = { solution, loading: false };
      updateScan(newId, updates);
      setSelectedScan(prev => prev && prev.id === newId ? { ...prev, ...updates } : prev);
      setScans(prev => prev.map(s => s.id === newId ? { ...s, ...updates } : s));
    } catch (err) {
      console.error(err);
      const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan";
      const errorUpdate = { loading: false, error: "Gagal: " + errorMsg };
      updateScan(newId, errorUpdate);
      setSelectedScan(prev => prev && prev.id === newId ? { ...prev, ...errorUpdate } : prev);
    }
  };

  const handleDelete = (id: string) => {
    if(confirm("Hapus riwayat ini?")) {
        deleteScan(id);
        setScans(prev => prev.filter(s => s.id !== id));
        if (selectedScan?.id === id) {
            setView(ViewState.LIST);
            setSelectedScan(null);
        }
    }
  };

  const formatDate = (timestamp: number) => {
    try {
        return new Date(timestamp).toLocaleDateString('id-ID', {
          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
        });
    } catch (e) { return '-'; }
  };

  // --- Helper: Advanced Rendering with KaTeX ---
  const renderFormattedSolution = (text: string | undefined) => {
    if (!text) return '';

    // Step 1: Handle Block Math ($$ ... $$) or (\[ ... \])
    let processed = text.replace(/(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g, (_, _open, texContent, _close) => {
        try {
            if ((window as any).katex) {
                return (window as any).katex.renderToString(texContent, { displayMode: true, throwOnError: false });
            }
        } catch (e) { console.error(e); }
        return `<div class="katex-display">${texContent}</div>`;
    });

    // Step 2: Handle Inline Math ($ ... $) or (\( ... \))
    processed = processed.replace(/(\$|\\\()([^$\n]+?)(\$|\\\))/g, (_, _open, texContent, _close) => {
        try {
            if ((window as any).katex) {
                return (window as any).katex.renderToString(texContent, { displayMode: false, throwOnError: false });
            }
        } catch (e) { console.error(e); }
        return `<span class="katex">${texContent}</span>`;
    });

    // Step 3: Markdown Formatting
    processed = processed
        // Headers
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        // Bold
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        // Italic
        .replace(/(?<!\\)_(.*?)_/g, '<em>$1</em>')
        // Lists
        .replace(/^\* (.*?)$/gm, '<ul><li>$1</li></ul>') 
        .replace(/^- (.*?)$/gm, '<ul><li>$1</li></ul>') 
        .replace(/(<\/ul>\n<ul>)/g, '') // Merge adjacent lists
        // Newlines to BR
        .replace(/\n/g, '<br/>');

    return processed;
  };

  // --- VIEWS ---

  if (!apiKey) return <ApiKeyInput onSave={handleSaveKey} />;

  // 1. CROP VIEW (Overlay)
  if (tempImageForCrop) {
    return (
      <CropModal 
        imageData={tempImageForCrop}
        onConfirm={handleCropConfirm}
        onCancel={() => setTempImageForCrop(null)}
      />
    );
  }

  // 2. CAMERA VIEW
  if (view === ViewState.CAMERA) {
    return (
      <CameraCapture 
        onCapture={handleCameraCapture} 
        onCancel={() => setView(ViewState.STAGING)} 
      />
    );
  }

  // 3. STAGING VIEW (Compose Question)
  if (view === ViewState.STAGING) {
      return (
          <div className="min-h-screen bg-white flex flex-col">
              {showTextModal && (
                <TextInputModal 
                    onConfirm={handleAddText}
                    onCancel={() => setShowTextModal(false)}
                />
              )}

              <div className="bg-white border-b px-4 py-3 flex items-center shadow-sm z-10">
                  <button onClick={() => setView(ViewState.LIST)} className="mr-3 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h1 className="font-bold text-lg">Buat Pertanyaan</h1>
                  <span className="ml-auto text-sm text-gray-500">Item: {stagingImages.length + stagingTexts.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pb-32">
                  {/* Empty State */}
                  {stagingImages.length === 0 && stagingTexts.length === 0 && (
                      <div className="text-center py-10 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl mb-4">
                          <p>Belum ada soal (Foto/Teks)</p>
                          <p className="text-xs mt-1">Gunakan tombol di bawah untuk menambah soal</p>
                      </div>
                  )}

                  {/* Mixed Grid for Images and Text */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                      {/* Render Images */}
                      {stagingImages.map((img, idx) => (
                          <div key={`img-${idx}`} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                              <img src={img} alt={`scan-${idx}`} className="w-full h-full object-cover" />
                              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">Foto #{idx+1}</div>
                              <button 
                                onClick={() => removeStagingImage(idx)}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                              </button>
                          </div>
                      ))}

                      {/* Render Texts */}
                      {stagingTexts.map((txt, idx) => (
                          <div key={`txt-${idx}`} className="relative aspect-square bg-yellow-50 rounded-xl border border-yellow-200 shadow-sm p-3 flex flex-col">
                              <div className="flex-1 overflow-hidden">
                                <p className="text-xs font-mono text-yellow-800 mb-1">Teks #{idx+1}</p>
                                <p className="text-sm text-gray-700 line-clamp-4 leading-relaxed font-medium">"{txt}"</p>
                              </div>
                              <button 
                                onClick={() => removeStagingText(idx)}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 shadow-sm hover:bg-red-600 transition-colors"
                              >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                              </button>
                          </div>
                      ))}
                  </div>

                  {/* Settings */}
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <label className="block text-sm font-semibold text-gray-700 mb-3">Gaya Penjelasan:</label>
                      <div className="space-y-2">
                          {[
                              { id: 'detailed', label: 'Lengkap & Rinci', desc: 'Langkah demi langkah' },
                              { id: 'brief', label: 'Singkat', desc: 'Penjelasan padat' },
                              { id: 'direct', label: 'Langsung Jawaban', desc: 'Tanpa basa-basi' }
                          ].map((opt) => (
                              <label key={opt.id} className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${explanationStyle === opt.id ? 'bg-indigo-50 border-indigo-200 ring-1 ring-indigo-500' : 'bg-white border-gray-200'}`}>
                                  <input 
                                    type="radio" 
                                    name="style" 
                                    value={opt.id}
                                    checked={explanationStyle === opt.id}
                                    onChange={(e) => setExplanationStyle(e.target.value as ExplanationStyle)}
                                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                                  />
                                  <div className="ml-3">
                                      <span className="block text-sm font-medium text-gray-900">{opt.label}</span>
                                      <span className="block text-xs text-gray-500">{opt.desc}</span>
                                  </div>
                              </label>
                          ))}
                      </div>
                  </div>
              </div>

              {/* Bottom Actions */}
              <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
                  {/* Action Buttons Row */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                      <Button variant="secondary" onClick={() => setView(ViewState.CAMERA)} className="py-3 text-xs flex-col h-auto gap-1" disabled={stagingImages.length >= 10}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Kamera
                      </Button>
                      
                      <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="py-3 text-xs flex-col h-auto gap-1" disabled={stagingImages.length >= 10}>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                        Upload
                      </Button>

                      <Button variant="secondary" onClick={() => setShowTextModal(true)} className="py-3 text-xs flex-col h-auto gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Tulis Soal
                      </Button>
                      
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        multiple 
                        onChange={handleFileUpload}
                      />
                  </div>
                  
                  <Button 
                    fullWidth 
                    onClick={handleProcessStaging} 
                    disabled={stagingImages.length === 0 && stagingTexts.length === 0}
                    className="py-4 text-lg shadow-xl shadow-indigo-100"
                  >
                      Kerjakan Soal ({stagingImages.length + stagingTexts.length})
                  </Button>
              </div>
          </div>
      );
  }

  // 4. SOLUTION VIEW
  if (view === ViewState.SOLUTION && selectedScan) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <button 
            onClick={() => setView(ViewState.LIST)}
            className="p-2 -ml-2 text-gray-600 hover:text-indigo-600 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <h1 className="font-semibold text-lg text-gray-800">Detail Jawaban</h1>
          <button 
            onClick={() => handleDelete(selectedScan.id)}
            className="p-2 -mr-2 text-red-500 hover:bg-red-50 rounded-full"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          
          {/* Input Section (Images and/or Text) */}
          <div className="bg-gray-100 border-b border-gray-200">
             
             {/* Text Inputs List */}
             {selectedScan.textInputs && selectedScan.textInputs.length > 0 && (
                 <div className="p-4 space-y-2 pb-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Soal Teks:</p>
                    {selectedScan.textInputs.map((text, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-gray-200 text-sm text-gray-800 shadow-sm">
                            <span className="font-bold text-indigo-600 mr-2">#{idx+1}</span>
                            {text}
                        </div>
                    ))}
                 </div>
             )}

             {/* Images List (Horizontal Scroll) */}
             {Array.isArray(selectedScan.images) && selectedScan.images.length > 0 && (
                <div className="p-4 pt-2">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Foto Soal:</p>
                    <div className="flex gap-2 overflow-x-auto pb-2 snap-x">
                        {selectedScan.images.map((img, i) => (
                            <img 
                                key={i}
                                src={img} 
                                alt={`Soal ${i+1}`} 
                                className="h-48 rounded-lg shadow-sm border border-gray-300 object-contain bg-white snap-center"
                            />
                        ))}
                    </div>
                 </div>
             )}
          </div>

          {/* Solution Section */}
          <div className="p-5">
            {selectedScan.loading ? (
               <div className="flex flex-col items-center justify-center py-12 space-y-4">
                 <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                 <p className="text-gray-500 font-medium animate-pulse">AI sedang mengerjakan...</p>
                 <div className="flex gap-2">
                    <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-500">Mode: {selectedScan.explanationStyle}</span>
                 </div>
               </div>
            ) : selectedScan.error ? (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">
                <p className="font-bold">Gagal:</p>
                <p>{selectedScan.error}</p>
              </div>
            ) : (
              <div className="prose prose-indigo max-w-none">
                <div className="flex items-center gap-2 mb-4 justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 m-0">Solusi</h2>
                    </div>
                </div>
                {/* Render markdown with custom processor */}
                <div 
                    className="markdown-body text-gray-800"
                    dangerouslySetInnerHTML={{ 
                        __html: renderFormattedSolution(selectedScan.solution)
                    }} 
                />
              </div>
            )}
          </div>
        </div>

        {/* Sticky Action */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <Button fullWidth onClick={startNewSession}>Scan Soal Lain</Button>
        </div>
      </div>
    );
  }

  // 5. LIST VIEW (Home)
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto shadow-2xl border-x border-gray-100">
        {/* Top Bar */}
        <div className="bg-white px-6 py-5 shadow-sm border-b border-gray-200 z-10 sticky top-0 flex justify-between items-center">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Matematika Pintar</h1>
                    <div className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold">BETA</div>
                </div>
                <p className="text-gray-500 text-sm">Asisten PR Matematika Pribadimu</p>
            </div>
            <div className="flex gap-2">
                <button 
                    onClick={handleCheckPermissions}
                    className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-lg transition-colors"
                    title="Cek Izin Kamera & Sistem"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                </button>
                <button 
                    onClick={handleResetKey}
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Ganti API Key / Reset"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                </button>
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 pb-24 overflow-y-auto">
            {scans.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center mt-10 opacity-70">
                    <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-4 text-gray-400">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">Belum ada scan</h3>
                    <p className="text-gray-500 text-sm max-w-[200px]">Tekan tombol di bawah untuk mulai.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    <h2 className="font-semibold text-gray-700 ml-1">Riwayat</h2>
                    {scans.map((scan) => (
                        <div 
                            key={scan.id}
                            onClick={() => { setSelectedScan(scan); setView(ViewState.SOLUTION); }}
                            className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex gap-4 hover:shadow-md transition-shadow cursor-pointer active:bg-gray-50"
                        >
                            <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200 relative flex items-center justify-center text-gray-400">
                                {/* Thumbnail Logic: Image > Text Icon > Fallback */}
                                {Array.isArray(scan.images) && scan.images.length > 0 ? (
                                    <>
                                        <img 
                                            src={scan.images[0]} 
                                            className="w-full h-full object-cover" 
                                            alt="thumbnail" 
                                        />
                                        {(scan.images.length > 1 || (scan.textInputs && scan.textInputs.length > 0)) && (
                                            <div className="absolute bottom-0 right-0 bg-black/50 text-white text-[10px] px-1 rounded-tl">
                                                +{ (scan.images.length - 1) + (scan.textInputs?.length || 0) }
                                            </div>
                                        )}
                                    </>
                                ) : (scan.textInputs && scan.textInputs.length > 0) ? (
                                    <div className="flex flex-col items-center">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-indigo-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span className="text-[10px] mt-1">Teks</span>
                                        {scan.textInputs.length > 1 && (
                                            <div className="absolute bottom-0 right-0 bg-indigo-500 text-white text-[10px] px-1 rounded-tl">
                                                +{scan.textInputs.length - 1}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <span className="text-xs">No Data</span>
                                )}
                            </div>
                            <div className="flex-1 flex flex-col justify-center">
                                <span className="text-xs text-gray-400 mb-1">{formatDate(scan.timestamp)}</span>
                                <p className="font-medium text-gray-800 line-clamp-2">
                                    {scan.solution 
                                        ? scan.solution.replace(/[#*]/g, '').slice(0, 50) + "..." 
                                        : "Sedang diproses..."}
                                </p>
                                <div className="mt-2 flex items-center gap-1 text-indigo-600 text-sm font-medium">
                                    Lihat Solusi 
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>

        {/* Floating Action Button */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-6">
            <Button 
                onClick={startNewSession} 
                fullWidth 
                className="shadow-xl shadow-indigo-200 py-4 text-lg rounded-full"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Buat Soal Baru
            </Button>
        </div>
    </div>
  );
};

export default App;