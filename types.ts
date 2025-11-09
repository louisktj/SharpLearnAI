export interface FocusDataPoint {
  timestamp: number;
  score: number;
}

export interface Session {
  id: string;
  className: string;
  subject: string;
  startTime: number;
  endTime: number;
  notes: string;
  summary: string;
  focusHistory: FocusDataPoint[];
  lowFocusTimestamps: number[];
  fullTranscript: string;
}

export enum AppState {
  SETUP,
  ACTIVE,
  SUMMARY,
  LOADING,
}

export interface RegisteredClass {
  id: string;
  name: string;
  sessions: Session[];
}

export interface ClassifiedCourseResult {
  subject: string;
  course: string;
  certainty: number;
  reasoning: string;
  question: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}
