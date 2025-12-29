
export interface AudioConfig {
  sampleRate: number;
  channels: number;
}

export interface TranscriptionItem {
  role: 'user' | 'model';
  text: string;
  id: string;
}

export enum ConnectionStatus {
  IDLE = 'IDLE',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  ERROR = 'ERROR',
  CLOSED = 'CLOSED'
}
