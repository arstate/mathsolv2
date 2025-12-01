
export type ExplanationStyle = 'brief' | 'detailed' | 'direct';

export type EducationLevel = 'Auto' | 'TK' | 'SD' | 'SMP' | 'SMA/SMK' | 'Kuliah (S1/D4)' | 'Umum';

export type Subject = 
  | 'Auto'
  | 'Matematika' 
  | 'Fisika' 
  | 'Kimia' 
  | 'Biologi' 
  | 'Sejarah' 
  | 'Geografi' 
  | 'Ekonomi' 
  | 'Sosiologi' 
  | 'B. Indonesia' 
  | 'B. Inggris' 
  | 'Coding/TI'
  | 'Lainnya';

export interface ScanResult {
  id: string;
  timestamp: number;
  images: string[];
  textInputs?: string[]; 
  explanationStyle: ExplanationStyle;
  
  // New Fields for General Education
  educationLevel: EducationLevel;
  subject: Subject;

  solution?: string;
  loading: boolean;
  error?: string;
}

export enum ViewState {
  CATEGORIES = 'CATEGORIES', // New Home View
  LIST_BY_CATEGORY = 'LIST_BY_CATEGORY',
  CAMERA = 'CAMERA',
  STAGING = 'STAGING',
  SOLUTION = 'SOLUTION'
}
