/**
 * Browser Cache Utility
 * ======================
 * Provides localStorage-based caching with TTL support
 * Cache Duration: 24 hours
 * Auto-clears on manual sync
 */

const BROWSER_CACHE_CONFIG = {
    TTL: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    VERSION: '1.0', // Increment to invalidate all caches
    PREFIX: 'fdbase_cache_'
};

/**
 * Browser Cache Manager
 */
class BrowserCache {
    constructor(pageKey) {
        this.pageKey = pageKey;
        this.cacheKey = `${BROWSER_CACHE_CONFIG.PREFIX}${pageKey}`;
        this.metaKey = `${this.cacheKey}_meta`;
    }

    /**
     * Get data from browser cache
     * @param {boolean} checkExpiry - Whether to check if cache is expired
     * @returns {Object|null} Cached data or null if not found/expired
     */
    get(checkExpiry = true) {
        try {
            // Get metadata
            const metaStr = localStorage.getItem(this.metaKey);
            if (!metaStr) {
                console.log(`🔍 Browser Cache: No cache found for ${this.pageKey}`);
                return null;
            }

            const meta = JSON.parse(metaStr);

            // Check version
            if (meta.version !== BROWSER_CACHE_CONFIG.VERSION) {
                console.log(`🔄 Browser Cache: Version mismatch, clearing cache for ${this.pageKey}`);
                this.clear();
                return null;
            }

            // Check expiry
            if (checkExpiry) {
                const now = Date.now();
                const age = now - meta.cachedAt;
                const ageHours = (age / (1000 * 60 * 60)).toFixed(1);

                if (age > BROWSER_CACHE_CONFIG.TTL) {
                    console.log(`⏰ Browser Cache: Expired (${ageHours}h old) for ${this.pageKey}`);
                    this.clear();
                    return null;
                }

                console.log(`✅ Browser Cache: Hit (${ageHours}h old) for ${this.pageKey}`);
            } else {
                console.log(`✅ Browser Cache: Hit (no expiry check) for ${this.pageKey}`);
            }

            // Get data
            const dataStr = localStorage.getItem(this.cacheKey);
            if (!dataStr) {
                console.log(`❌ Browser Cache: Metadata exists but no data for ${this.pageKey}`);
                this.clear();
                return null;
            }

            return JSON.parse(dataStr);

        } catch (error) {
            console.error(`❌ Browser Cache: Error reading cache for ${this.pageKey}:`, error);
            this.clear();
            return null;
        }
    }

    /**
     * Set data to browser cache
     * @param {Object} data - Data to cache
     * @param {Object} metadata - Optional metadata
     */
    set(data, metadata = {}) {
        try {
            const now = Date.now();

            // Create metadata
            const meta = {
                version: BROWSER_CACHE_CONFIG.VERSION,
                cachedAt: now,
                cachedAtReadable: new Date(now).toISOString(),
                pageKey: this.pageKey,
                ttlHours: BROWSER_CACHE_CONFIG.TTL / (1000 * 60 * 60),
                ...metadata
            };

            // Save data and metadata
            localStorage.setItem(this.cacheKey, JSON.stringify(data));
            localStorage.setItem(this.metaKey, JSON.stringify(meta));

            // Calculate size
            const dataSize = (JSON.stringify(data).length / 1024).toFixed(2);
            console.log(`💾 Browser Cache: Saved ${dataSize} KB for ${this.pageKey}`);

        } catch (error) {
            console.error(`❌ Browser Cache: Error saving cache for ${this.pageKey}:`, error);
            
            // Check if quota exceeded
            if (error.name === 'QuotaExceededError') {
                console.warn('⚠️ Browser Cache: Storage quota exceeded, clearing old caches...');
                this.clearAll();
            }
        }
    }

    /**
     * Clear cache for this page
     */
    clear() {
        try {
            localStorage.removeItem(this.cacheKey);
            localStorage.removeItem(this.metaKey);
            console.log(`🧹 Browser Cache: Cleared cache for ${this.pageKey}`);
        } catch (error) {
            console.error(`❌ Browser Cache: Error clearing cache for ${this.pageKey}:`, error);
        }
    }

    /**
     * Clear all browser caches
     */
    clearAll() {
        try {
            const keys = Object.keys(localStorage);
            let count = 0;

            keys.forEach(key => {
                if (key.startsWith(BROWSER_CACHE_CONFIG.PREFIX)) {
                    localStorage.removeItem(key);
                    count++;
                }
            });

            console.log(`🧹 Browser Cache: Cleared ${count} cache items`);
        } catch (error) {
            console.error('❌ Browser Cache: Error clearing all caches:', error);
        }
    }

    /**
     * Get cache info
     * @returns {Object} Cache information
     */
    getInfo() {
        try {
            const metaStr = localStorage.getItem(this.metaKey);
            if (!metaStr) {
                return {
                    exists: false,
                    pageKey: this.pageKey
                };
            }

            const meta = JSON.parse(metaStr);
            const now = Date.now();
            const age = now - meta.cachedAt;
            const remaining = BROWSER_CACHE_CONFIG.TTL - age;

            return {
                exists: true,
                pageKey: this.pageKey,
                cachedAt: meta.cachedAtReadable,
                ageMs: age,
                ageHours: (age / (1000 * 60 * 60)).toFixed(1),
                remainingMs: remaining > 0 ? remaining : 0,
                remainingHours: remaining > 0 ? (remaining / (1000 * 60 * 60)).toFixed(1) : 0,
                isExpired: remaining <= 0,
                ttlHours: meta.ttlHours,
                version: meta.version
            };
        } catch (error) {
            console.error('❌ Browser Cache: Error getting cache info:', error);
            return {
                exists: false,
                pageKey: this.pageKey,
                error: error.message
            };
        }
    }

    /**
     * Check if cache is valid
     * @returns {boolean} True if cache exists and is not expired
     */
    isValid() {
        const data = this.get(true);
        return data !== null;
    }
}

/**
 * Wrapper function to fetch data with browser cache
 * @param {string} pageKey - Unique key for this page
 * @param {Function} fetchFunction - Async function to fetch fresh data
 * @param {boolean} forceRefresh - Force refresh from server
 * @returns {Promise<Object>} Data from cache or server
 */
async function fetchWithBrowserCache(pageKey, fetchFunction, forceRefresh = false) {
    const cache = new BrowserCache(pageKey);

    // If force refresh, clear cache first
    if (forceRefresh) {
        console.log(`🔄 Force refresh requested for ${pageKey}`);
        cache.clear();
    }

    // Try to get from cache
    const cachedData = cache.get(true);
    if (cachedData && !forceRefresh) {
        console.log(`⚡ Using cached data for ${pageKey}`);
        return cachedData;
    }

    // Fetch fresh data
    console.log(`📡 Fetching fresh data for ${pageKey}...`);
    const freshData = await fetchFunction();

    // Save to cache
    if (freshData) {
        cache.set(freshData);
    }

    return freshData;
}

/**
 * Get all cache info
 * @returns {Array} Array of cache info for all pages
 */
function getAllCacheInfo() {
    const keys = Object.keys(localStorage);
    const cacheKeys = new Set();

    // Find all unique cache keys
    keys.forEach(key => {
        if (key.startsWith(BROWSER_CACHE_CONFIG.PREFIX) && !key.endsWith('_meta')) {
            const pageKey = key.replace(BROWSER_CACHE_CONFIG.PREFIX, '');
            cacheKeys.add(pageKey);
        }
    });

    // Get info for each cache
    return Array.from(cacheKeys).map(pageKey => {
        const cache = new BrowserCache(pageKey);
        return cache.getInfo();
    });
}

/**
 * Clear all expired caches
 */
function clearExpiredCaches() {
    const allCaches = getAllCacheInfo();
    let count = 0;

    allCaches.forEach(info => {
        if (info.isExpired) {
            const cache = new BrowserCache(info.pageKey);
            cache.clear();
            count++;
        }
    });

    console.log(`🧹 Browser Cache: Cleared ${count} expired cache(s)`);
}

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.BrowserCache = BrowserCache;
    window.fetchWithBrowserCache = fetchWithBrowserCache;
    window.getAllCacheInfo = getAllCacheInfo;
    window.clearExpiredCaches = clearExpiredCaches;
}

