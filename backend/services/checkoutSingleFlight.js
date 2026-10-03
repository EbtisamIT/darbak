const createCheckoutSingleFlight = (getKey, handler) => {
  const active = new Map();

  return async (req, res, next) => {
    const key = getKey(req);
    if (!key) return handler(req, res, next);

    while (active.has(key)) {
      await active.get(key);
    }

    let release;
    const finished = new Promise((resolve) => {
      release = resolve;
    });
    active.set(key, finished);

    try {
      return await handler(req, res, next);
    } finally {
      if (active.get(key) === finished) active.delete(key);
      release();
    }
  };
};

module.exports = { createCheckoutSingleFlight };
