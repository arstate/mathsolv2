export interface ScanResult {
  id: string;
  timestamp: number;
  imageUrl: string;
  questionText?: string;
  solution?: string;
  loading: boolean;
  error?: string;
}

export enum ViewState {
  LIST = 'LIST',
  CAMERA = 'CAMERA',
  SOLUTION = 'SOLUTION'
}