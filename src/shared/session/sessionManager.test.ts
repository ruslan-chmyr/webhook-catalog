import { describe, expect, it } from 'vitest';
import { createSessionManager } from './sessionManager';
import type { SessionEndReason, SessionManagerOptions } from './sessionManager.types';

type Deferred = {
  promise: Promise<void>;
  resolve: () => void;
  reject: (reason?: unknown) => void;
};

function createDeferred(): Deferred {
  let resolvePromise: ((value: void) => void) | undefined;
  let rejectPromise: ((reason?: unknown) => void) | undefined;

  const promise = new Promise<void>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  if (resolvePromise === undefined || rejectPromise === undefined) {
    throw new Error('Deferred promise executor did not run.');
  }

  const resolveDeferred = resolvePromise;
  const rejectDeferred = rejectPromise;

  return {
    promise,
    resolve: () => {
      resolveDeferred(undefined);
    },
    reject: rejectDeferred,
  };
}

function createOptions(
  rotateRequest: SessionManagerOptions['rotateRequest'],
  onSessionInvalidated: SessionManagerOptions['onSessionInvalidated'] = () => {},
): SessionManagerOptions {
  return { rotateRequest, onSessionInvalidated };
}

describe('createSessionManager', () => {
  it('starts inactive with zero counters', async () => {
    const manager = createSessionManager(createOptions(() => Promise.resolve()));

    expect(manager.isActive()).toBe(false);
    expect(manager.getGeneration()).toBe(0);
    expect(manager.getAuthEpoch()).toBe(0);

    await expect(manager.rotate()).rejects.toThrow('Cannot rotate an inactive session.');
    expect(manager.isActive()).toBe(false);
    expect(manager.getGeneration()).toBe(0);
    expect(manager.getAuthEpoch()).toBe(0);
  });

  it('startSession activates a new lifecycle', async () => {
    const manager = createSessionManager(createOptions(() => Promise.resolve()));

    manager.startSession();

    expect(manager.isActive()).toBe(true);
    expect(manager.getAuthEpoch()).toBe(1);
    expect(manager.getGeneration()).toBe(0);

    await manager.rotate();

    expect(manager.getGeneration()).toBe(1);
    expect(manager.getAuthEpoch()).toBe(1);

    manager.startSession();

    expect(manager.isActive()).toBe(true);
    expect(manager.getAuthEpoch()).toBe(2);
    expect(manager.getGeneration()).toBe(0);
  });

  it('calls rotateRequest once for concurrent rotations', async () => {
    const request = createDeferred();
    let calls = 0;
    const manager = createSessionManager(
      createOptions(() => {
        calls += 1;
        return request.promise;
      }),
    );

    manager.startSession();

    const first = manager.rotate();
    const second = manager.rotate();
    const third = manager.rotate();

    expect(calls).toBe(1);

    request.resolve();
    await Promise.all([first, second, third]);

    expect(calls).toBe(1);
  });

  it('resolves concurrent callers and increments generation once', async () => {
    const request = createDeferred();
    const manager = createSessionManager(createOptions(() => request.promise));

    manager.startSession();

    const rotations = [manager.rotate(), manager.rotate(), manager.rotate()];

    request.resolve();
    await Promise.all(rotations);

    expect(manager.getGeneration()).toBe(1);
    expect(manager.getAuthEpoch()).toBe(1);
    expect(manager.isActive()).toBe(true);

    await manager.rotate();

    expect(manager.getGeneration()).toBe(2);
    expect(manager.getAuthEpoch()).toBe(1);
  });

  it('propagates a rejected rotation and allows a later retry', async () => {
    const failure = new Error('rotation failed');
    const retry = createDeferred();
    let calls = 0;
    const reasons: SessionEndReason[] = [];
    const manager = createSessionManager(
      createOptions(
        () => {
          calls += 1;
          if (calls === 1) {
            return Promise.reject(failure);
          }

          return retry.promise;
        },
        (reason) => {
          reasons.push(reason);
        },
      ),
    );

    manager.startSession();

    const first = manager.rotate();
    const second = manager.rotate();

    await Promise.all([expect(first).rejects.toBe(failure), expect(second).rejects.toBe(failure)]);

    expect(calls).toBe(1);
    expect(manager.isActive()).toBe(true);
    expect(manager.getGeneration()).toBe(0);
    expect(manager.getAuthEpoch()).toBe(1);
    expect(reasons).toEqual([]);

    const third = manager.rotate();
    expect(calls).toBe(2);

    retry.resolve();
    await third;

    expect(manager.getGeneration()).toBe(1);
    expect(manager.isActive()).toBe(true);
  });

  it('invalidates synchronously on logout and notifies once', async () => {
    const reasons: SessionEndReason[] = [];
    let activeDuringNotify = true;
    let epochDuringNotify = 0;
    let generationDuringNotify = -1;
    const manager = createSessionManager(
      createOptions(
        () => Promise.resolve(),
        (reason) => {
          reasons.push(reason);
          activeDuringNotify = manager.isActive();
          epochDuringNotify = manager.getAuthEpoch();
          generationDuringNotify = manager.getGeneration();
        },
      ),
    );

    manager.startSession();
    await manager.rotate();
    await manager.rotate();

    expect(manager.getGeneration()).toBe(2);

    manager.invalidate('logout');

    expect(manager.isActive()).toBe(false);
    expect(manager.getGeneration()).toBe(0);
    expect(manager.getAuthEpoch()).toBe(2);
    expect(reasons).toEqual(['logout']);
    expect(activeDuringNotify).toBe(false);
    expect(epochDuringNotify).toBe(2);
    expect(generationDuringNotify).toBe(0);
    await expect(manager.rotate()).rejects.toThrow('Cannot rotate an inactive session.');
  });

  it('does not notify when invalidate is repeated while inactive', () => {
    const reasons: SessionEndReason[] = [];
    const manager = createSessionManager(
      createOptions(
        () => Promise.resolve(),
        (reason) => {
          reasons.push(reason);
        },
      ),
    );

    manager.invalidate('logout');
    manager.invalidate('authentication-failed');

    expect(reasons).toEqual([]);
    expect(manager.isActive()).toBe(false);
    expect(manager.getAuthEpoch()).toBe(0);
    expect(manager.getGeneration()).toBe(0);

    manager.startSession();
    manager.invalidate('authentication-failed');
    manager.invalidate('logout');
    manager.invalidate('authentication-failed');

    expect(reasons).toEqual(['authentication-failed']);
    expect(manager.isActive()).toBe(false);
    expect(manager.getAuthEpoch()).toBe(2);
    expect(manager.getGeneration()).toBe(0);
  });

  it('ignores a stale rotation success after invalidation', async () => {
    const request = createDeferred();
    const reasons: SessionEndReason[] = [];
    const manager = createSessionManager(
      createOptions(
        () => request.promise,
        (reason) => {
          reasons.push(reason);
        },
      ),
    );

    manager.startSession();
    const rotation = manager.rotate();

    manager.invalidate('logout');

    expect(manager.isActive()).toBe(false);
    expect(manager.getGeneration()).toBe(0);
    expect(manager.getAuthEpoch()).toBe(2);
    expect(reasons).toEqual(['logout']);

    request.resolve();
    await expect(rotation).rejects.toThrow('Session changed during rotation.');

    expect(manager.isActive()).toBe(false);
    expect(manager.getGeneration()).toBe(0);
    expect(manager.getAuthEpoch()).toBe(2);
    expect(reasons).toEqual(['logout']);
  });

  it('starts a new rotation after invalidation instead of reusing the old one', async () => {
    const firstRequest = createDeferred();
    const secondRequest = createDeferred();
    let calls = 0;
    const manager = createSessionManager(
      createOptions(() => {
        calls += 1;
        return calls === 1 ? firstRequest.promise : secondRequest.promise;
      }),
    );

    manager.startSession();
    const firstRotation = manager.rotate();
    expect(calls).toBe(1);

    manager.invalidate('authentication-failed');
    manager.startSession();

    const secondRotation = manager.rotate();
    expect(calls).toBe(2);
    expect(manager.getGeneration()).toBe(0);
    expect(manager.getAuthEpoch()).toBe(3);

    firstRequest.resolve();
    await expect(firstRotation).rejects.toThrow('Session changed during rotation.');

    expect(calls).toBe(2);
    expect(manager.getGeneration()).toBe(0);
    expect(manager.isActive()).toBe(true);

    secondRequest.resolve();
    await secondRotation;

    expect(manager.getGeneration()).toBe(1);
    expect(manager.getAuthEpoch()).toBe(3);
  });

  it('keeps the newer pending rotation when an older rotation completes', async () => {
    const firstRequest = createDeferred();
    const secondRequest = createDeferred();
    let calls = 0;
    const manager = createSessionManager(
      createOptions(() => {
        calls += 1;
        return calls === 1 ? firstRequest.promise : secondRequest.promise;
      }),
    );

    manager.startSession();
    const oldRotation = manager.rotate();

    manager.invalidate('logout');
    manager.startSession();

    const newRotation = manager.rotate();
    expect(calls).toBe(2);

    firstRequest.resolve();
    await expect(oldRotation).rejects.toThrow('Session changed during rotation.');

    const sharedRotation = manager.rotate();
    expect(calls).toBe(2);
    expect(manager.getGeneration()).toBe(0);

    secondRequest.resolve();
    await Promise.all([newRotation, sharedRotation]);

    expect(calls).toBe(2);
    expect(manager.getGeneration()).toBe(1);
    expect(manager.isActive()).toBe(true);
    expect(manager.getAuthEpoch()).toBe(3);
  });

  it('keeps rotation state separate for each instance', async () => {
    const requestA = createDeferred();
    const requestB = createDeferred();
    let callsA = 0;
    let callsB = 0;
    const reasonsA: SessionEndReason[] = [];
    const reasonsB: SessionEndReason[] = [];

    const managerA = createSessionManager(
      createOptions(
        () => {
          callsA += 1;
          return requestA.promise;
        },
        (reason) => {
          reasonsA.push(reason);
        },
      ),
    );
    const managerB = createSessionManager(
      createOptions(
        () => {
          callsB += 1;
          return requestB.promise;
        },
        (reason) => {
          reasonsB.push(reason);
        },
      ),
    );

    managerA.startSession();
    managerB.startSession();

    const rotationA = managerA.rotate();
    const rotationB = managerB.rotate();

    expect(callsA).toBe(1);
    expect(callsB).toBe(1);

    requestA.resolve();
    await rotationA;

    expect(managerA.getGeneration()).toBe(1);
    expect(managerB.getGeneration()).toBe(0);
    expect(managerB.isActive()).toBe(true);

    managerB.invalidate('logout');

    expect(managerA.isActive()).toBe(true);
    expect(managerA.getAuthEpoch()).toBe(1);
    expect(managerA.getGeneration()).toBe(1);
    expect(managerB.isActive()).toBe(false);
    expect(managerB.getAuthEpoch()).toBe(2);
    expect(reasonsA).toEqual([]);
    expect(reasonsB).toEqual(['logout']);

    requestB.resolve();
    await expect(rotationB).rejects.toThrow('Session changed during rotation.');
    expect(managerB.getGeneration()).toBe(0);
    expect(callsA).toBe(1);
    expect(callsB).toBe(1);
  });
});
