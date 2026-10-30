export type CsrfManagerOptions = {
  loadToken: () => Promise<string>;
};

export type CsrfManager = {
  ensure: () => Promise<void>;
  getToken: () => string | null;
  clear: () => void;
  refresh: () => Promise<void>;
};

export function createCsrfManager(options: CsrfManagerOptions): CsrfManager {
  let token: string | null = null;
  let pending: Promise<void> | null = null;
  let epoch = 0;

  function clear(): void {
    token = null;
    epoch += 1;
    pending = null;
  }

  function ensure(): Promise<void> {
    if (token !== null) {
      return Promise.resolve();
    }

    if (pending !== null) {
      return pending;
    }

    const epochAtStart = epoch;
    let request: Promise<string>;

    try {
      request = options.loadToken();
    } catch (error) {
      return Promise.reject(error);
    }

    const promise = request.then((nextToken) => {
      if (epoch !== epochAtStart) {
        throw new Error('CSRF token request is obsolete.');
      }

      token = nextToken;
    });

    pending = promise;

    const clearIfCurrent = (): void => {
      if (pending === promise) {
        pending = null;
      }
    };

    void promise.then(clearIfCurrent, clearIfCurrent);

    return promise;
  }

  function refresh(): Promise<void> {
    clear();
    return ensure();
  }

  return {
    ensure,
    getToken: () => token,
    clear,
    refresh,
  };
}
