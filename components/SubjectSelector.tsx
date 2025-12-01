
import React from 'react';
import { EducationLevel, Subject } from '../types';

interface Props {
  level: EducationLevel;
  subject: Subject;
  customSubject?: string;
  onLevelChange: (l: EducationLevel) => void;
  onSubjectChange: (s: Subject) => void;
  onCustomSubjectChange?: (s: string) => void;
}

const LEVELS: EducationLevel[] = ['Auto', 'TK', 'SD', 'SMP', 'SMA/SMK', 'Kuliah (S1/D4)', 'Umum'];
const SUBJECTS: Subject[] = [
    'Auto', 'Matematika', 'Fisika', 'Kimia', 'Biologi', 
    'Sejarah', 'Geografi', 'Ekonomi', 'Sosiologi', 
    'B. Indonesia', 'B. Inggris', 'Coding/TI', 'Lainnya'
];

export const SubjectSelector: React.FC<Props> = ({ 
  level, 
  subject, 
  customSubject = '', 
  onLevelChange, 
  onSubjectChange,
  onCustomSubjectChange
}) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-4">
      <div className="grid grid-cols-2 gap-4">
        {/* Level Selector */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Jenjang Pendidikan</label>
          <select 
            value={level} 
            onChange={(e) => onLevelChange(e.target.value as EducationLevel)}
            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {LEVELS.map(l => (
                <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>

        {/* Subject Selector */}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mata Pelajaran</label>
          <select 
            value={subject} 
            onChange={(e) => onSubjectChange(e.target.value as Subject)}
            className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-indigo-500 outline-none"
          >
            {SUBJECTS.map(s => (
                <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Custom Subject Input */}
      {subject === 'Lainnya' && onCustomSubjectChange && (
          <div className="mt-3 animate-fade-in">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Tulis Nama Mata Pelajaran</label>
              <input 
                type="text"
                value={customSubject}
                onChange={(e) => onCustomSubjectChange(e.target.value)}
                placeholder="Contoh: Akuntansi, Filsafat, dll."
                className="w-full p-2 bg-white border border-indigo-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
          </div>
      )}

      <div className="mt-2 flex items-center gap-2">
         <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">i</div>
         <p className="text-[10px] text-gray-400">Pilih "Auto" jika Anda ingin AI mendeteksi sendiri.</p>
      </div>
    </div>
  );
};
