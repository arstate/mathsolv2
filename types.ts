export type ExplanationStyle = 'brief' | 'detailed' | 'direct';

export interface ScanResult {
  id: string;
  timestamp: number;
  // Changed from single imageUrl to array
  images: string[];
  explanationStyle: ExplanationStyle;
  solution?: string;
  loading: boolean;
  error?: string;
}

export enum ViewState {
  LIST = 'LIST',
  CAMERA = 'CAMERA',
  STAGING = 'STAGING', // New state for reviewing/cropping before solving
  SOLUTION = 'SOLUTION'
}
