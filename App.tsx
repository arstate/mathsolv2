
import React, { useState, useEffect, useRef } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { Button } from './components/Button';
import { ApiKeyInput } from './components/ApiKeyInput';
import { CropModal } from './components/CropModal';
import { TextInputModal } from './components/TextInputModal';
import { SubjectSelector } from './components/SubjectSelector';
import { ScanResult, ViewState, ExplanationStyle, EducationLevel, Subject } from './types';
import { getScans, saveScan, updateScan, deleteScan, getUserPreferences, saveUserPreferences, UserPreferences } from './services/storageService';
import { solveGeneralProblem } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.CATEGORIES);
  const [scans, setScans] = useState<ScanResult[]>([]);
  
  // Navigation State
  const [selectedScan, setSelectedScan] = useState<ScanResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{level: string, subject: string} | null>(null);

  // Staging State
  const [stagingImages, setStagingImages] = useState<string[]>([]);
  const [stagingTexts, setStagingTexts] = useState<string[]>([]);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
  const [showTextModal, setShowTextModal] = useState(false);
  
  // Preferences State
  const [explanationStyle, setExplanationStyle] = useState<ExplanationStyle>('detailed');
  const [currentLevel, setCurrentLevel] = useState<EducationLevel>('Auto');
  const [currentSubject, setCurrentSubject] = useState<Subject>('Auto');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  useEffect(() => {
    setScans(getScans());
    // Load saved preferences
    const prefs = getUserPreferences();
    setCurrentLevel(prefs.level);
    setCurrentSubject(prefs.subject);
  }, []);

  // Update preferences when changed
  const handleLevelChange = (l: EducationLevel) => {
    setCurrentLevel(l);
    saveUserPreferences({ level: l, subject: currentSubject });
  };

  const handleSubjectChange = (s: Subject) => {
    setCurrentSubject(s);
    saveUserPreferences({ level: currentLevel, subject: s });
  };

  const handleSaveKey = (key: string) => {
    setApiKey(key);
  };

  const handleResetKey = () => {
    if (confirm("Reset API Key untuk sesi ini?")) {
        setApiKey(null);
        setView(ViewState.CATEGORIES);
    }
  };

  const handleCheckPermissions = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop());
        alert("✅ Izin Kamera Aktif!");
    } catch (err) {
        alert("⚠️ Akses Kamera Ditolak. Mohon izinkan akses di browser.");
    }
  };

  // --- Workflow Methods ---

  const startNewSession = () => {
    setStagingImages([]);
    setStagingTexts([]);
    setExplanationStyle('detailed');
    // Level & Subject already loaded from prefs/state
    setView(ViewState.STAGING);
  };

  const handleCameraCapture = (imageData: string) => {
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
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropConfirm = (croppedData: string) => {
    if (stagingImages.length >= 10) { 
        alert("Maksimal 10 gambar per sesi.");
        return;
    }
    setStagingImages(prev => [...prev, croppedData]);
    setTempImageForCrop(null);
    setView(ViewState.STAGING); 
  };

  const handleAddText = (text: string) => {
    setStagingTexts(prev => [...prev, text]);
    setShowTextModal(false);
  };

  const handleProcessStaging = async () => {
    if (!apiKey) return;
    if (stagingImages.length === 0 && stagingTexts.length === 0) {
        alert("Mohon masukkan gambar atau teks.");
        return;
    }

    const newId = Date.now().toString();
    const newScan: ScanResult = {
      id: newId,
      timestamp: Date.now(),
      images: stagingImages,
      textInputs: stagingTexts,
      explanationStyle,
      educationLevel: currentLevel,
      subject: currentSubject,
      loading: true,
    };

    saveScan(newScan);
    setScans(prev => [newScan, ...prev]);
    setSelectedScan(newScan);
    setView(ViewState.SOLUTION);

    try {
      const solution = await solveGeneralProblem(
          stagingImages, 
          stagingTexts, 
          apiKey, 
          explanationStyle,
          currentLevel,
          currentSubject
      );
      const updates = { solution, loading: false };
      updateScan(newId, updates);
      setSelectedScan(prev => prev && prev.id === newId ? { ...prev, ...updates } : prev);
      setScans(prev => prev.map(s => s.id === newId ? { ...s, ...updates } : s));
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Terjadi kesalahan";
      const errorUpdate = { loading: false, error: "Gagal: " + errorMsg };
      updateScan(newId, errorUpdate);
      setSelectedScan(prev => prev && prev.id === newId ? { ...prev, ...errorUpdate } : prev);
    }
  };

  const handleDelete = (id: string) => {
    if(confirm("Hapus soal ini?")) {
        deleteScan(id);
        setScans(prev => prev.filter(s => s.id !== id));
        if (selectedScan?.id === id) {
            // Go back to list if we deleted the open one
            setView(ViewState.LIST_BY_CATEGORY); 
            setSelectedScan(null);
        }
    }
  };

  const renderFormattedSolution = (text: string | undefined) => {
    if (!text) return '';
    let processed = text.replace(/(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g, (_, _open, texContent) => {
        try {
            if ((window as any).katex) {
                return (window as any).katex.renderToString(texContent, { displayMode: true, throwOnError: false });
            }
        } catch (e) {}
        return `<div class="katex-display">${texContent}</div>`;
    });
    processed = processed.replace(/(\$|\\\()([^$\n]+?)(\$|\\\))/g, (_, _open, texContent) => {
        try {
            if ((window as any).katex) {
                return (window as any).katex.renderToString(texContent, { displayMode: false, throwOnError: false });
            }
        } catch (e) {}
        return `<span class="katex">${texContent}</span>`;
    });
    processed = processed
        .replace(/^### (.*?)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*?)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/(?<!\\)_(.*?)_/g, '<em>$1</em>')
        .replace(/^\* (.*?)$/gm, '<ul><li>$1</li></ul>') 
        .replace(/^- (.*?)$/gm, '<ul><li>$1</li></ul>') 
        .replace(/(<\/ul>\n<ul>)/g, '') 
        .replace(/\n/g, '<br/>');
    return processed;
  };

  // --- GROUPING LOGIC ---
  
  const getCategories = () => {
    const groups: Record<string, {level: string, subject: string, count: number, lastTime: number}> = {};
    
    scans.forEach(scan => {
        const key = `${scan.educationLevel}|${scan.subject}`;
        if (!groups[key]) {
            groups[key] = { 
                level: scan.educationLevel, 
                subject: scan.subject, 
                count: 0,
                lastTime: scan.timestamp
            };
        }
        groups[key].count++;
        if (scan.timestamp > groups[key].lastTime) {
            groups[key].lastTime = scan.timestamp;
        }
    });
    
    // Convert to array and sort by latest
    return Object.values(groups).sort((a, b) => b.lastTime - a.lastTime);
  };

  const getFilteredScans = () => {
    if (!selectedCategory) return [];
    return scans.filter(s => 
        s.educationLevel === selectedCategory.level && 
        s.subject === selectedCategory.subject
    );
  };

  // --- VIEWS ---

  if (!apiKey) return <ApiKeyInput onSave={handleSaveKey} />;

  if (tempImageForCrop) {
    return (
      <CropModal 
        imageData={tempImageForCrop}
        onConfirm={handleCropConfirm}
        onCancel={() => setTempImageForCrop(null)}
      />
    );
  }

  if (view === ViewState.CAMERA) {
    return <CameraCapture onCapture={handleCameraCapture} onCancel={() => setView(ViewState.STAGING)} />;
  }

  // 1. STAGING (Compose)
  if (view === ViewState.STAGING) {
      return (
          <div className="min-h-screen bg-white flex flex-col">
              {showTextModal && (
                <TextInputModal onConfirm={handleAddText} onCancel={() => setShowTextModal(false)} />
              )}

              <div className="bg-white border-b px-4 py-3 flex items-center shadow-sm">
                  <button onClick={() => setView(ViewState.CATEGORIES)} className="mr-3 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <h1 className="font-bold text-lg">Buat Pertanyaan</h1>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pb-32">
                  <SubjectSelector 
                    level={currentLevel} 
                    subject={currentSubject}
                    onLevelChange={handleLevelChange}
                    onSubjectChange={handleSubjectChange}
                  />

                  {stagingImages.length === 0 && stagingTexts.length === 0 && (
                      <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl mb-4">
                          <p>Mulai dengan mengambil foto atau ketik soal.</p>
                      </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 mb-6">
                      {stagingImages.map((img, idx) => (
                          <div key={`img-${idx}`} className="relative aspect-square bg-gray-100 rounded-xl overflow-hidden border">
                              <img src={img} className="w-full h-full object-cover" />
                              <button onClick={() => setStagingImages(p => p.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                          </div>
                      ))}
                      {stagingTexts.map((txt, idx) => (
                          <div key={`txt-${idx}`} className="relative aspect-square bg-yellow-50 rounded-xl border border-yellow-200 p-2">
                              <p className="text-xs text-gray-700 line-clamp-4">{txt}</p>
                              <button onClick={() => setStagingTexts(p => p.filter((_, i) => i !== idx))} className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg></button>
                          </div>
                      ))}
                  </div>
              </div>

              <div className="fixed bottom-0 left-0 right-0 bg-white p-4 border-t shadow-[0_-4px_10px_rgba(0,0,0,0.05)] z-20">
                  <div className="grid grid-cols-3 gap-2 mb-3">
                      <Button variant="secondary" onClick={() => setView(ViewState.CAMERA)} className="py-2 text-xs flex-col h-auto gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>Kamera
                      </Button>
                      <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="py-2 text-xs flex-col h-auto gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>Upload
                      </Button>
                      <Button variant="secondary" onClick={() => setShowTextModal(true)} className="py-2 text-xs flex-col h-auto gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>Tulis Soal
                      </Button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                  </div>
                  <Button fullWidth onClick={handleProcessStaging} disabled={stagingImages.length === 0 && stagingTexts.length === 0}>
                      Kirim ke AI
                  </Button>
              </div>
          </div>
      );
  }

  // 2. SOLUTION
  if (view === ViewState.SOLUTION && selectedScan) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
          <button onClick={() => setView(ViewState.LIST_BY_CATEGORY)} className="p-2 -ml-2 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div className="flex flex-col items-center">
             <span className="text-sm font-bold text-gray-900">{selectedScan.subject}</span>
             <span className="text-xs text-gray-500">{selectedScan.educationLevel}</span>
          </div>
          <button onClick={() => handleDelete(selectedScan.id)} className="p-2 -mr-2 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pb-24">
          <div className="bg-gray-50 border-b p-4">
             {selectedScan.textInputs?.map((text, idx) => (
                <div key={idx} className="bg-white p-3 rounded-lg border mb-2 text-sm">
                    <span className="font-bold text-indigo-600 mr-2">Q:</span>{text}
                </div>
             ))}
             {selectedScan.images?.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                    {selectedScan.images.map((img, i) => <img key={i} src={img} className="h-32 rounded-lg border bg-white" />)}
                </div>
             )}
          </div>
          <div className="p-5">
            {selectedScan.loading ? (
               <div className="flex flex-col items-center py-12">
                 <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                 <p className="text-gray-500 animate-pulse">Menganalisis Soal...</p>
               </div>
            ) : selectedScan.error ? (
              <div className="bg-red-50 text-red-600 p-4 rounded border-red-100">{selectedScan.error}</div>
            ) : (
              <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderFormattedSolution(selectedScan.solution) }} />
            )}
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
            <Button fullWidth onClick={startNewSession}>Tanya Lagi</Button>
        </div>
      </div>
    );
  }

  // 3. CATEGORY LIST (FOLDER VIEW)
  if (view === ViewState.CATEGORIES) {
      const categories = getCategories();
      
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto border-x">
            <div className="bg-white px-6 py-5 shadow-sm border-b z-10 sticky top-0 flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tanya AI</h1>
                    <p className="text-gray-500 text-sm">Asisten Belajar Semua Jenjang</p>
                </div>
                <div className="flex gap-2">
                    <button onClick={handleCheckPermissions} className="p-2 text-indigo-500 bg-indigo-50 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                    <button onClick={handleResetKey} className="p-2 text-gray-400 bg-gray-100 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
                </div>
            </div>

            <div className="flex-1 p-4 pb-24 overflow-y-auto">
                <div className="mb-4 bg-indigo-600 rounded-xl p-4 text-white shadow-lg shadow-indigo-200">
                    <h3 className="font-bold text-lg mb-1">Mulai Belajar</h3>
                    <p className="text-indigo-100 text-sm mb-3">Tanyakan soal apa saja, dari TK hingga Kuliah.</p>
                    <div className="flex items-center gap-2 text-xs bg-white/20 p-2 rounded-lg">
                        <span>🎓 {currentLevel}</span>
                        <span>•</span>
                        <span>📚 {currentSubject}</span>
                    </div>
                </div>

                <h2 className="font-bold text-gray-800 mb-3 text-lg">Kategori Soal Anda</h2>
                {categories.length === 0 ? (
                    <div className="text-center py-10 opacity-50">
                        <p>Belum ada riwayat soal.</p>
                        <p className="text-sm">Klik tombol + untuk mulai.</p>
                    </div>
                ) : (
                    <div className="grid gap-3">
                        {categories.map((cat, idx) => (
                            <div 
                                key={idx}
                                onClick={() => { setSelectedCategory(cat); setView(ViewState.LIST_BY_CATEGORY); }}
                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-indigo-300 transition-all cursor-pointer flex justify-between items-center"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                                        {cat.subject.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{cat.subject}</h3>
                                        <p className="text-xs text-gray-500">{cat.level} • {cat.count} Soal</p>
                                    </div>
                                </div>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                </svg>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-6">
                <Button onClick={startNewSession} fullWidth className="shadow-xl py-4 text-lg rounded-full">
                    + Buat Pertanyaan Baru
                </Button>
            </div>
        </div>
      );
  }

  // 4. LIST WITHIN CATEGORY
  if (view === ViewState.LIST_BY_CATEGORY && selectedCategory) {
      const filteredScans = getFilteredScans();
      return (
        <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto border-x">
             <div className="bg-white px-4 py-3 border-b flex items-center sticky top-0 z-10">
                  <button onClick={() => setView(ViewState.CATEGORIES)} className="mr-3 text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div>
                      <h1 className="font-bold text-lg">{selectedCategory.subject}</h1>
                      <p className="text-xs text-gray-500">{selectedCategory.level}</p>
                  </div>
             </div>
             
             <div className="flex-1 p-4 pb-24 overflow-y-auto space-y-3">
                 {filteredScans.map(scan => (
                     <div 
                        key={scan.id} 
                        onClick={() => { setSelectedScan(scan); setView(ViewState.SOLUTION); }}
                        className="bg-white p-3 rounded-xl shadow-sm border flex gap-3 cursor-pointer"
                     >
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden">
                             {scan.images.length > 0 ? (
                                <img src={scan.images[0]} className="w-full h-full object-cover"/>
                             ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400">Teks</div>
                             )}
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-gray-400 mb-1">{new Date(scan.timestamp).toLocaleDateString()}</p>
                            <p className="font-medium text-gray-800 line-clamp-2 text-sm">
                                {scan.solution ? scan.solution.replace(/[#*]/g, '') : "Loading..."}
                            </p>
                        </div>
                     </div>
                 ))}
             </div>
             
             <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-6">
                <Button onClick={startNewSession} fullWidth className="shadow-xl py-4 text-lg rounded-full">
                    + Tambah Soal {selectedCategory.subject}
                </Button>
            </div>
        </div>
      );
  }

  return null;
};

export default App;
