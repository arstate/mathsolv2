import React, { useState, useEffect, useRef } from 'react';
import { Button } from './Button';

interface TextInputModalProps {
  initialValue?: string;
  onConfirm: (text: string) => void;
  onCancel: () => void;
}

export const TextInputModal: React.FC<TextInputModalProps> = ({ initialValue = '', onConfirm, onCancel }) => {
  const [text, setText] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Auto-focus when modal opens
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = () => {
    if (text.trim()) {
      onConfirm(text.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">Tulis Soal Matematika</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          <label className="block text-sm font-medium text-gray-600 mb-2">
            Ketik soal Anda di sini:
          </label>
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Contoh: Sebuah segitiga memiliki alas 10cm dan tinggi 5cm. Hitunglah luasnya..."
            className="w-full h-48 p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-gray-800 text-lg leading-relaxed shadow-sm"
          />
          <p className="text-xs text-gray-400 mt-2 text-right">
            {text.length} karakter
          </p>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Batal
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={!text.trim()} 
            className="flex-1"
          >
            Simpan Soal
          </Button>
        </div>
      </div>
    </div>
  );
};