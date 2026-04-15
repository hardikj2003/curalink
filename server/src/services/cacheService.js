const cache = new Map();

const DEFAULT_TTL = 1000 * 60 * 10; // 10 minutes

const generateKey = ({ query, disease, location }) => {
  return `${disease}::${query}::${location || "global"}`.toLowerCase();
};

const getCache = (key) => {
  const entry = cache.get(key);

  if (!entry) return null;

  const isExpired = Date.now() > entry.expiry;

  if (isExpired) {
    cache.delete(key);
    return null;
  }

  return entry.data;
};

const setCache = (key, data, ttl = DEFAULT_TTL) => {
  cache.set(key, {
    data,
    expiry: Date.now() + ttl,
  });
};

module.exports = {
  generateKey,
  getCache,
  setCache,
};
