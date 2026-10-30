export type SessionEndReason = 'logout' | 'authentication-failed';

export type SessionManagerOptions = {
  rotateRequest: () => Promise<void>;
  onSessionInvalidated: (reason: SessionEndReason) => void;
};

export type SessionManager = {
  rotate: () => Promise<void>;
  getGeneration: () => number;
  getAuthEpoch: () => number;
  isActive: () => boolean;
  startSession: () => void;
  invalidate: (reason: SessionEndReason) => void;
};
