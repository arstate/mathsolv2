
import React, { useState, useEffect, useRef } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { Button } from './components/Button';
import { ApiKeyInput } from './components/ApiKeyInput';
import { CropModal } from './components/CropModal';
import { TextInputModal } from './components/TextInputModal';
import { SubjectSelector } from './components/SubjectSelector';
import { ExplanationSelector } from './components/ExplanationSelector';
import { ScanResult, ViewState, ExplanationStyle, EducationLevel, Subject, AppMode } from './types';
import { getScans, saveScan, updateScan, deleteScan, getUserPreferences, saveUserPreferences } from './services/storageService';
import { solveGeneralProblem, generateTeacherQuestions } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.CATEGORIES);
  const [appMode, setAppMode] = useState<AppMode>('student');
  const [scans, setScans] = useState<ScanResult[]>([]);
  
  // Navigation State
  const [selectedScan, setSelectedScan] = useState<ScanResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<{level: string, subject: string, custom?: string} | null>(null);

  // Staging State
  const [stagingImages, setStagingImages] = useState<string[]>([]);
  const [stagingTexts, setStagingTexts] = useState<string[]>([]);
  const [tempImageForCrop, setTempImageForCrop] = useState<string | null>(null);
  const [showTextModal, setShowTextModal] = useState(false);
  
  // Teacher Specific Staging
  const [questionCount, setQuestionCount] = useState<number>(5);
  
  // Preferences State
  const [explanationStyle, setExplanationStyle] = useState<ExplanationStyle>('detailed');
  const [currentLevel, setCurrentLevel] = useState<EducationLevel>('Auto');
  const [currentSubject, setCurrentSubject] = useState<Subject>('Auto');
  const [customSubject, setCustomSubject] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiKey, setApiKey] = useState<string | null>(null);

  // Touch Gesture State
  const touchStartRef = useRef<number | null>(null);

  useEffect(() => {
    setScans(getScans());
    const prefs = getUserPreferences();
    setCurrentLevel(prefs.level);
    setCurrentSubject(prefs.subject);
    if(prefs.customSubject) setCustomSubject(prefs.customSubject);
  }, []);

  const handleLevelChange = (l: EducationLevel) => {
    setCurrentLevel(l);
    saveUserPreferences({ level: l, subject: currentSubject, customSubject });
  };

  const handleSubjectChange = (s: Subject) => {
    setCurrentSubject(s);
    saveUserPreferences({ level: currentLevel, subject: s, customSubject });
  };

  const handleCustomSubjectChange = (s: string) => {
    setCustomSubject(s);
    saveUserPreferences({ level: currentLevel, subject: currentSubject, customSubject: s });
  };

  const handleSaveKey = (key: string) => setApiKey(key);

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

  // --- SWIPE LOGIC ---
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (view !== ViewState.CATEGORIES) return; // Only swipe on home screen
    if (!touchStartRef.current) return;
    
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStartRef.current - touchEnd;
    
    // Swipe Left (Diff > 50) -> Go to Teacher (Right Side)
    if (diff > 50 && appMode === 'student') {
        setAppMode('teacher');
    }
    // Swipe Right (Diff < -50) -> Go to Student (Left Side)
    if (diff < -50 && appMode === 'teacher') {
        setAppMode('student');
    }
    
    touchStartRef.current = null;
  };

  // --- Workflow Methods ---

  const startNewSession = () => {
    setStagingImages([]);
    setStagingTexts([]);
    setExplanationStyle('detailed');
    setView(ViewState.STAGING);
  };

  const handleCameraCapture = (imageData: string) => setTempImageForCrop(imageData);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') setTempImageForCrop(reader.result);
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
        alert("Mohon masukkan materi (gambar/teks).");
        return;
    }
    
    if (appMode === 'teacher' && currentSubject === 'Lainnya' && !customSubject.trim()) {
        alert("Mohon isi nama mata pelajaran.");
        return;
    }

    const newId = Date.now().toString();
    const newScan: ScanResult = {
      id: newId,
      timestamp: Date.now(),
      mode: appMode,
      images: stagingImages,
      textInputs: stagingTexts,
      explanationStyle,
      educationLevel: currentLevel,
      subject: currentSubject,
      customSubject: currentSubject === 'Lainnya' ? customSubject : undefined,
      questionCount: appMode === 'teacher' ? questionCount : undefined,
      loading: true,
    };

    saveScan(newScan);
    setScans(prev => [newScan, ...prev]);
    setSelectedScan(newScan);

    // FIX: Set selected category so 'Back' button works and doesn't show white screen
    const displayedSubject = (currentSubject === 'Lainnya' && customSubject) ? customSubject : currentSubject;
    setSelectedCategory({
        level: currentLevel,
        subject: displayedSubject,
        custom: currentSubject === 'Lainnya' ? customSubject : undefined
    });

    setView(ViewState.SOLUTION);

    try {
      let solution = "";
      if (appMode === 'student') {
          solution = await solveGeneralProblem(
              stagingImages, 
              stagingTexts, 
              apiKey, 
              explanationStyle,
              currentLevel,
              currentSubject,
              customSubject
          );
      } else {
          solution = await generateTeacherQuestions(
              stagingImages,
              stagingTexts, 
              apiKey,
              explanationStyle,
              currentLevel,
              currentSubject,
              customSubject,
              questionCount
          );
      }

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
    if(confirm("Hapus item ini?")) {
        deleteScan(id);
        setScans(prev => prev.filter(s => s.id !== id));
        if (selectedScan?.id === id) {
             // Safe navigation back
            if (selectedCategory) {
                 setView(ViewState.LIST_BY_CATEGORY);
            } else {
                 setView(ViewState.CATEGORIES);
            }
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
    // Filter by Mode first
    const filteredByMode = scans.filter(s => s.mode === appMode);
    
    const groups: Record<string, {level: string, subject: string, custom?: string, count: number, lastTime: number}> = {};
    
    filteredByMode.forEach(scan => {
        const subjName = scan.customSubject || scan.subject;
        const key = `${scan.educationLevel}|${subjName}`;
        if (!groups[key]) {
            groups[key] = { 
                level: scan.educationLevel, 
                subject: subjName,
                custom: scan.customSubject,
                count: 0,
                lastTime: scan.timestamp
            };
        }
        groups[key].count++;
        if (scan.timestamp > groups[key].lastTime) {
            groups[key].lastTime = scan.timestamp;
        }
    });
    
    return Object.values(groups).sort((a, b) => b.lastTime - a.lastTime);
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

  const isTeacher = appMode === 'teacher';
  const themeColor = isTeacher ? 'emerald' : 'indigo'; // Tailwinds colors: emerald vs indigo

  // 1. STAGING (COMPOSE)
  if (view === ViewState.STAGING) {
      return (
          <div className={`min-h-screen bg-white flex flex-col ${isTeacher ? 'theme-teacher' : ''}`}>
              {showTextModal && (
                <TextInputModal onConfirm={handleAddText} onCancel={() => setShowTextModal(false)} />
              )}

              <div className="bg-white border-b px-4 py-3 flex items-center shadow-sm sticky top-0 z-10">
                  <button onClick={() => setView(ViewState.CATEGORIES)} className="mr-3 text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <h1 className={`font-bold text-lg text-${themeColor}-600`}>
                      {isTeacher ? 'Buat Soal Ujian (Guru)' : 'Tanyakan Soal (Siswa)'}
                  </h1>
              </div>

              <div className="flex-1 overflow-y-auto p-4 pb-40">
                  <div className={`p-4 rounded-xl border mb-4 ${isTeacher ? 'bg-emerald-50 border-emerald-100' : 'bg-indigo-50 border-indigo-100'}`}>
                    <p className="text-xs font-bold uppercase text-gray-500 mb-2">Konfigurasi {isTeacher ? 'Ujian' : 'Belajar'}</p>
                    <SubjectSelector 
                        level={currentLevel} 
                        subject={currentSubject}
                        customSubject={customSubject}
                        onLevelChange={handleLevelChange}
                        onSubjectChange={handleSubjectChange}
                        onCustomSubjectChange={handleCustomSubjectChange}
                    />

                    {isTeacher && (
                        <div className="bg-white p-3 rounded-lg border border-gray-200 mb-4 shadow-sm">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Jumlah Soal: <span className="text-emerald-600 text-lg">{questionCount}</span></label>
                            <input 
                                type="range" 
                                min="1" 
                                max="10" 
                                value={questionCount} 
                                onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <div className="flex justify-between text-xs text-gray-400 mt-1">
                                <span>1</span><span>10</span>
                            </div>
                        </div>
                    )}
                    
                    <div className="mt-2">
                        <ExplanationSelector 
                            selected={explanationStyle}
                            onSelect={setExplanationStyle}
                        />
                    </div>
                  </div>

                  <p className="text-sm font-bold text-gray-700 mb-2">
                      {isTeacher ? 'Input Materi / Sumber Soal' : 'Input Soal / Gambar'}
                  </p>
                  
                  {stagingImages.length === 0 && stagingTexts.length === 0 && (
                      <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-200 rounded-xl mb-4">
                          <p>Ambil foto buku, teks materi, atau ketik topik di sini.</p>
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                        {isTeacher ? 'Teks Materi' : 'Tulis Soal'}
                      </Button>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                  </div>
                  <button 
                    onClick={handleProcessStaging} 
                    disabled={stagingImages.length === 0 && stagingTexts.length === 0}
                    className={`w-full py-3 rounded-xl font-semibold text-white shadow-lg transition-all ${
                        isTeacher 
                        ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' 
                        : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                    } disabled:opacity-50`}
                  >
                      {isTeacher ? 'Buat Soal & Jawaban' : 'Kirim ke AI'}
                  </button>
              </div>
          </div>
      );
  }

  // 2. SOLUTION VIEW (SAME FOR BOTH, JUST DIFFERENT HEADER)
  if (view === ViewState.SOLUTION && selectedScan) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="sticky top-0 z-10 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
          <button onClick={() => {
              if (selectedCategory) setView(ViewState.LIST_BY_CATEGORY);
              else setView(ViewState.CATEGORIES);
          }} className="p-2 -ml-2 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <div className="flex flex-col items-center">
             <span className={`text-sm font-bold ${selectedScan.mode === 'teacher' ? 'text-emerald-700' : 'text-indigo-700'}`}>
                 {selectedScan.customSubject || selectedScan.subject}
             </span>
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
                    <span className="font-bold text-gray-500 mr-2">Input:</span>{text}
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
                 <div className={`w-10 h-10 border-4 rounded-full animate-spin mb-4 ${selectedScan.mode === 'teacher' ? 'border-emerald-200 border-t-emerald-600' : 'border-indigo-200 border-t-indigo-600'}`}></div>
                 <p className="text-gray-500 animate-pulse">
                     {selectedScan.mode === 'teacher' ? 'Sedang membuat soal...' : 'Menganalisis soal...'}
                 </p>
               </div>
            ) : selectedScan.error ? (
              <div className="bg-red-50 text-red-600 p-4 rounded border-red-100">{selectedScan.error}</div>
            ) : (
              <div className="markdown-body" dangerouslySetInnerHTML={{ __html: renderFormattedSolution(selectedScan.solution) }} />
            )}
          </div>
        </div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t">
            <Button fullWidth onClick={startNewSession} variant={selectedScan.mode === 'teacher' ? 'primary' : 'primary'} className={selectedScan.mode === 'teacher' ? 'bg-emerald-600 hover:bg-emerald-700' : ''}>
                {selectedScan.mode === 'teacher' ? 'Buat Soal Lain' : 'Tanya Lagi'}
            </Button>
        </div>
      </div>
    );
  }

  // 3. CATEGORIES / HOME VIEW
  if (view === ViewState.CATEGORIES) {
      const categories = getCategories();
      
      return (
        <div 
            className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto border-x transition-colors duration-300"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
        >
            <div className="bg-white px-6 py-5 shadow-sm border-b z-10 sticky top-0">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h1 className={`text-2xl font-bold ${isTeacher ? 'text-emerald-800' : 'text-indigo-800'}`}>
                            {isTeacher ? 'Mode Pengajar' : 'Mode Siswa'}
                        </h1>
                        <p className="text-gray-500 text-xs">
                            {isTeacher ? 'Buat soal & kunci jawaban otomatis' : 'Tanya soal dan dapatkan jawaban'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                         <button onClick={handleCheckPermissions} className="p-2 text-gray-500 bg-gray-100 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg></button>
                        <button onClick={handleResetKey} className="p-2 text-gray-400 bg-gray-100 rounded-lg"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg></button>
                    </div>
                </div>

                {/* MODE TOGGLE */}
                <div className="bg-gray-100 p-1 rounded-xl flex relative">
                    <div 
                        className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-white rounded-lg shadow-sm transition-all duration-300 ease-in-out ${isTeacher ? 'left-[calc(50%+2px)]' : 'left-1'}`}
                    ></div>
                    <button 
                        onClick={() => setAppMode('student')}
                        className={`flex-1 relative z-10 py-2 text-sm font-semibold text-center transition-colors ${!isTeacher ? 'text-indigo-600' : 'text-gray-500'}`}
                    >
                        Siswa
                    </button>
                    <button 
                        onClick={() => setAppMode('teacher')}
                        className={`flex-1 relative z-10 py-2 text-sm font-semibold text-center transition-colors ${isTeacher ? 'text-emerald-600' : 'text-gray-500'}`}
                    >
                        Guru
                    </button>
                </div>
            </div>

            <div className="flex-1 p-4 pb-24 overflow-y-auto">
                <div className={`mb-4 rounded-xl p-4 text-white shadow-lg transition-colors duration-500 ${isTeacher ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-600 shadow-indigo-200'}`}>
                    <h3 className="font-bold text-lg mb-1">{isTeacher ? 'Bank Soal Saya' : 'Mulai Belajar'}</h3>
                    <p className={`text-sm mb-3 ${isTeacher ? 'text-emerald-100' : 'text-indigo-100'}`}>
                        {isTeacher ? 'Buat soal ujian dengan cepat.' : 'Tanyakan soal apa saja, dari TK hingga Kuliah.'}
                    </p>
                    <div className="flex items-center gap-2 text-xs bg-white/20 p-2 rounded-lg">
                        <span>🎓 {currentLevel}</span>
                        <span>•</span>
                        <span>📚 {customSubject || currentSubject}</span>
                    </div>
                </div>

                <h2 className="font-bold text-gray-800 mb-3 text-lg">
                    {isTeacher ? 'Kategori Soal Dibuat' : 'Kategori Soal Anda'}
                </h2>
                
                {categories.length === 0 ? (
                    <div className="text-center py-10 opacity-50">
                        <p>{isTeacher ? 'Belum ada soal dibuat.' : 'Belum ada riwayat soal.'}</p>
                        <p className="text-sm">Klik tombol + untuk mulai.</p>
                        <p className="text-xs mt-4 text-gray-400">Tips: Geser layar ke {isTeacher ? 'kanan' : 'kiri'} untuk ganti mode.</p>
                    </div>
                ) : (
                    <div className="grid gap-3 animate-fade-in">
                        {categories.map((cat, idx) => (
                            <div 
                                key={idx}
                                onClick={() => { setSelectedCategory({level: cat.level, subject: cat.subject, custom: cat.custom}); setView(ViewState.LIST_BY_CATEGORY); }}
                                className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:border-indigo-300 transition-all cursor-pointer flex justify-between items-center"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${isTeacher ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                        {cat.subject.charAt(0)}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-800">{cat.subject}</h3>
                                        <p className="text-xs text-gray-500">{cat.level} • {cat.count} Item</p>
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
                <button 
                    onClick={startNewSession} 
                    className={`w-full shadow-xl py-4 text-lg rounded-full font-bold text-white transition-all flex items-center justify-center gap-2 ${isTeacher ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                >
                    <span>+</span> {isTeacher ? 'Buat Soal Baru' : 'Buat Pertanyaan Baru'}
                </button>
            </div>
        </div>
      );
  }

  // 4. LIST WITHIN CATEGORY
  if (view === ViewState.LIST_BY_CATEGORY && selectedCategory) {
      // Logic inside getCategories already filters by mode, but we need to fetch all and filter manually here
      const filteredScans = scans.filter(s => 
          s.mode === appMode &&
          s.educationLevel === selectedCategory.level && 
          (s.customSubject || s.subject) === selectedCategory.subject
      );

      return (
        <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto border-x">
             <div className="bg-white px-4 py-3 border-b flex items-center sticky top-0 z-10">
                  <button onClick={() => setView(ViewState.CATEGORIES)} className="mr-3 text-gray-600">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  </button>
                  <div>
                      <h1 className={`font-bold text-lg ${isTeacher ? 'text-emerald-800' : 'text-indigo-800'}`}>
                          {selectedCategory.subject}
                      </h1>
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
                                <div className="w-full h-full flex items-center justify-center text-xs text-gray-400 font-medium bg-gray-50">Teks</div>
                             )}
                        </div>
                        <div className="flex-1">
                            <p className="text-xs text-gray-400 mb-1">{new Date(scan.timestamp).toLocaleDateString()}</p>
                            <p className="font-medium text-gray-800 line-clamp-2 text-sm">
                                {scan.solution ? scan.solution.replace(/[#*]/g, '').substring(0, 100) : "Memproses..."}
                            </p>
                        </div>
                     </div>
                 ))}
             </div>
             
             <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-6">
                <button 
                    onClick={startNewSession} 
                    className={`w-full shadow-xl py-4 text-lg rounded-full font-bold text-white transition-all ${isTeacher ? 'bg-emerald-600' : 'bg-indigo-600'}`}
                >
                    + {isTeacher ? 'Buat Soal' : 'Tanya Soal'} {selectedCategory.subject}
                </button>
            </div>
        </div>
      );
  }

  return null;
};

export default App;
