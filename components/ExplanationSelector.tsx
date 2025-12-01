
import React from 'react';
import { ExplanationStyle } from '../types';

interface Props {
  selected: ExplanationStyle;
  onSelect: (style: ExplanationStyle) => void;
}

export const ExplanationSelector: React.FC<Props> = ({ selected, onSelect }) => {
  const options: { value: ExplanationStyle; label: string; icon: string }[] = [
    { 
      value: 'detailed', 
      label: 'Detail', 
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01' 
    },
    { 
      value: 'brief', 
      label: 'Singkat', 
      icon: 'M4 6h16M4 12h16M4 18h7' 
    },
    { 
      value: 'direct', 
      label: 'Jawaban Saja', 
      icon: 'M5 13l4 4L19 7' 
    },
  ];

  return (
    <div className="mb-4">
        <label className="block text-xs font-bold text-gray-500 uppercase mb-2 ml-1">Gaya Jawaban</label>
        <div className="bg-gray-100 p-1 rounded-xl flex">
        {options.map((opt) => {
            const isActive = selected === opt.value;
            return (
            <button
                key={opt.value}
                onClick={() => onSelect(opt.value)}
                className={`flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-lg text-xs font-medium transition-all duration-200 ${
                isActive 
                    ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
            >
                <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 mb-1 ${isActive ? 'text-indigo-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={opt.icon} />
                </svg>
                {opt.label}
            </button>
            );
        })}
        </div>
    </div>
  );
};
