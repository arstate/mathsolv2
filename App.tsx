import React, { useState, useEffect } from 'react';
import { CameraCapture } from './components/CameraCapture';
import { Button } from './components/Button';
import { ApiKeyInput } from './components/ApiKeyInput';
import { ScanResult, ViewState } from './types';
import { getScans, saveScan, updateScan, deleteScan } from './services/storageService';
import { solveMathProblem } from './services/geminiService';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.LIST);
  const [scans, setScans] = useState<ScanResult[]>([]);
  const [selectedScan, setSelectedScan] = useState<ScanResult | null>(null);
  
  // API Key State
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [isCheckingKey, setIsCheckingKey] = useState(true);

  // Load history and key on mount
  useEffect(() => {
    setScans(getScans());
    
    const storedKey = localStorage.getItem('gemini_api_key');
    if (storedKey) {
      setApiKey(storedKey);
    }
    setIsCheckingKey(false);
  }, []);

  const handleSaveKey = (key: string) => {
    localStorage.setItem('gemini_api_key', key);
    setApiKey(key);
  };

  const handleResetKey = () => {
    if (confirm("Apakah Anda yakin ingin menghapus API Key? Anda harus memasukkannya lagi nanti.")) {
        localStorage.removeItem('gemini_api_key');
        setApiKey(null);
        setView(ViewState.LIST);
    }
  };

  const handleStartCamera = () => {
    setView(ViewState.CAMERA);
  };

  const handleCapture = async (imageData: string) => {
    if (!apiKey) return;

    // Create initial scan object
    const newId = Date.now().toString();
    const newScan: ScanResult = {
      id: newId,
      timestamp: Date.now(),
      imageUrl: imageData,
      loading: true,
    };

    // Save locally and update state
    saveScan(newScan);
    setScans(prev => [newScan, ...prev]);
    
    // Move to detail view immediately
    setSelectedScan(newScan);
    setView(ViewState.SOLUTION);

    // Trigger AI processing
    try {
      // Pass the API key explicitly
      const solution = await solveMathProblem(imageData, apiKey);
      
      const updates = { 
        solution, 
        loading: false,
      };
      
      updateScan(newId, updates);
      
      // Update local state if the user is still viewing this item
      setSelectedScan(prev => prev && prev.id === newId ? { ...prev, ...updates } : prev);
      
      // Update list state
      setScans(prev => prev.map(s => s.id === newId ? { ...s, ...updates } : s));
      
    } catch (err) {
      console.error(err);
      const errorUpdate = { loading: false, error: "Gagal memproses gambar." };
      updateScan(newId, errorUpdate);
      setSelectedScan(prev => prev && prev.id === newId ? { ...prev, ...errorUpdate } : prev);
    }
  };

  const handleDelete = (id: string) => {
    if(confirm("Apakah anda yakin ingin menghapus riwayat ini?")) {
        deleteScan(id);
        setScans(prev => prev.filter(s => s.id !== id));
        if (selectedScan?.id === id) {
            setView(ViewState.LIST);
            setSelectedScan(null);
        }
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    });
  };

  // --- RENDER VIEWS ---

  if (isCheckingKey) {
    return <div className="min-h-screen bg-white flex items-center justify-center">Loading...</div>;
  }

  // Show Onboarding if no key
  if (!apiKey) {
    return <ApiKeyInput onSave={handleSaveKey} />;
  }

  if (view === ViewState.CAMERA) {
    return (
      <CameraCapture 
        onCapture={handleCapture} 
        onCancel={() => setView(ViewState.LIST)} 
      />
    );
  }

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
          {/* Image Section */}
          <div className="bg-gray-100 p-4 flex justify-center">
            <img 
              src={selectedScan.imageUrl} 
              alt="Soal" 
              className="max-h-64 rounded-lg shadow-md border border-gray-300 object-contain"
            />
          </div>

          {/* Solution Section */}
          <div className="p-5">
            {selectedScan.loading ? (
               <div className="flex flex-col items-center justify-center py-12 space-y-4">
                 <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
                 <p className="text-gray-500 font-medium animate-pulse">AI sedang menganalisa...</p>
                 <p className="text-sm text-gray-400 text-center max-w-xs">Kami sedang membaca soal dan menghitung jawabannya untukmu.</p>
               </div>
            ) : selectedScan.error ? (
              <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">
                {selectedScan.error}
              </div>
            ) : (
              <div className="prose prose-indigo max-w-none">
                <div className="flex items-center gap-2 mb-4">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-bold text-gray-900 m-0">Solusi</h2>
                </div>
                {/* Render simple markdown */}
                <div 
                    className="markdown-body text-gray-800"
                    dangerouslySetInnerHTML={{ 
                        __html: selectedScan.solution?.replace(/\n/g, '<br/>')
                                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Simple bold parser
                                    .replace(/### (.*?)(<br\/>|$)/g, '<h2>$1</h2>') // Simple H3 parser
                                    || '' 
                    }} 
                />
              </div>
            )}
          </div>
        </div>

        {/* Sticky Action */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <Button fullWidth onClick={handleStartCamera}>Scan Soal Lain</Button>
        </div>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto shadow-2xl">
        {/* Top Bar */}
        <div className="bg-white px-6 py-5 shadow-sm border-b border-gray-200 z-10 sticky top-0 flex justify-between items-center">
            <div>
                <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Matematika Pintar</h1>
                    <div className="bg-indigo-100 text-indigo-700 px-2 py-1 rounded text-xs font-bold">BETA</div>
                </div>
                <p className="text-gray-500 text-sm">Asisten PR Matematika Pribadimu</p>
            </div>
            
            <button 
                onClick={handleResetKey}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Ganti API Key"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
            </button>
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
                    <p className="text-gray-500 text-sm max-w-[200px]">Tekan tombol di bawah untuk mulai memecahkan soal matematika.</p>
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
                            <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                <img src={scan.imageUrl} className="w-full h-full object-cover" alt="thumbnail" />
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

        {/* Floating Action Button (Sticky) */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-6">
            <Button 
                onClick={handleStartCamera} 
                fullWidth 
                className="shadow-xl shadow-indigo-200 py-4 text-lg rounded-full"
            >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Scan Soal Matematika
            </Button>
        </div>
    </div>
  );
};

export default App;