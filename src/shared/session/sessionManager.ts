import type { SessionEndReason, SessionManager, SessionManagerOptions } from './sessionManager.types';

export function createSessionManager(options: SessionManagerOptions): SessionManager {
  let rotatePromise: Promise<void> | null = null;
  let sessionGeneration = 0;
  let authEpoch = 0;
  let active = false;

  function detachPendingRotation(): void {
    rotatePromise = null;
  }

  function startSession(): void {
    active = true;
    authEpoch += 1;
    sessionGeneration = 0;
    detachPendingRotation();
  }

  function invalidate(reason: SessionEndReason): void {
    if (!active) {
      return;
    }

    active = false;
    authEpoch += 1;
    sessionGeneration = 0;
    detachPendingRotation();
    options.onSessionInvalidated(reason);
  }

  function rotate(): Promise<void> {
    if (!active) {
      return Promise.reject(new Error('Cannot rotate an inactive session.'));
    }

    if (rotatePromise !== null) {
      return rotatePromise;
    }

    const epoch = authEpoch;

    let request: Promise<void>;
    try {
      request = options.rotateRequest();
    } catch (error) {
      return Promise.reject(error);
    }

    const promise = request.then(() => {
      if (!active || authEpoch !== epoch) {
        throw new Error('Session changed during rotation.');
      }

      sessionGeneration += 1;
    });

    rotatePromise = promise;

    const clearIfCurrent = (): void => {
      // A newer session may already own the slot. Only this operation may clear it.
      if (rotatePromise === promise) {
        rotatePromise = null;
      }
    };

    void promise.then(clearIfCurrent, clearIfCurrent);

    return promise;
  }

  return {
    rotate,
    getGeneration: () => sessionGeneration,
    getAuthEpoch: () => authEpoch,
    isActive: () => active,
    startSession,
    invalidate,
  };
}
