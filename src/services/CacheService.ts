/**
 * CacheService — File-based video caching for low-end devices
 *
 * Replaces the browser IndexedDB cache from SeamlessPlayer.tsx.
 * Downloads videos to local filesystem with LRU eviction.
 */

import RNFS from 'react-native-fs';
import { MAX_CACHE_MB as MAX_CACHE_MB_ENV } from '@env';

const CACHE_DIR = `${RNFS.CachesDirectoryPath}/video-cache`;
const MANIFEST_PATH = `${CACHE_DIR}/_manifest.json`;
const MAX_CACHE_MB = parseInt(MAX_CACHE_MB_ENV || '200', 10);
const MAX_CACHE_BYTES = MAX_CACHE_MB * 1024 * 1024;

interface CacheEntry {
    url: string;
    filename: string;
    size: number;
    accessedAt: number;
}

interface CacheManifest {
    entries: CacheEntry[];
}

class CacheService {
    private manifest: CacheManifest = { entries: [] };
    private initialized = false;
    private activeDownloads = new Map<string, Promise<string | null>>();

    /**
     * Initialize cache directory and load manifest.
     */
    async init(): Promise<void> {
        if (this.initialized) return;

        const exists = await RNFS.exists(CACHE_DIR);
        if (!exists) {
            await RNFS.mkdir(CACHE_DIR);
        }

        await this.loadManifest();
        this.initialized = true;
    }

    /**
     * Get local file path for a cached video URL.
     * Returns null if not cached.
     */
    async getCachedPath(url: string): Promise<string | null> {
        await this.init();

        const entry = this.manifest.entries.find((e) => e.url === url);
        if (!entry) return null;

        const filePath = `${CACHE_DIR}/${entry.filename}`;
        const exists = await RNFS.exists(filePath);

        if (!exists) {
            // File was deleted externally; remove from manifest
            this.manifest.entries = this.manifest.entries.filter(
                (e) => e.url !== url,
            );
            await this.saveManifest();
            return null;
        }

        // Update access time
        entry.accessedAt = Date.now();
        await this.saveManifest();

        return filePath;
    }

    /**
     * Download and cache a video from URL.
     * Returns local file path on success, null on failure.
     * Deduplicates concurrent downloads of the same URL.
     */
    async prefetchVideo(url: string): Promise<string | null> {
        await this.init();

        // Check if already cached
        const existing = await this.getCachedPath(url);
        if (existing) return existing;

        // Check if download already in progress
        const active = this.activeDownloads.get(url);
        if (active) return active;

        // Start download
        const downloadPromise = this._download(url);
        this.activeDownloads.set(url, downloadPromise);

        try {
            const result = await downloadPromise;
            return result;
        } finally {
            this.activeDownloads.delete(url);
        }
    }

    private async _download(url: string): Promise<string | null> {
        try {
            // Generate filename from URL hash
            const filename = this.urlToFilename(url);
            const filePath = `${CACHE_DIR}/${filename}`;

            // Download
            const result = await RNFS.downloadFile({
                fromUrl: url,
                toFile: filePath,
                background: false,
                discretionary: false,
            }).promise;

            if (result.statusCode !== 200) {
                // Clean up partial download
                const exists = await RNFS.exists(filePath);
                if (exists) await RNFS.unlink(filePath);
                return null;
            }

            // Get file size
            const stat = await RNFS.stat(filePath);
            const size = parseInt(String(stat.size), 10);

            // Add to manifest
            this.manifest.entries.push({
                url,
                filename,
                size,
                accessedAt: Date.now(),
            });

            await this.saveManifest();

            // Evict old entries if over budget
            await this.evictOldVideos();

            return filePath;
        } catch (error) {
            // Caching is best-effort; don't break playback
            return null;
        }
    }

    /**
     * Evict least-recently-used videos until total cache is under budget.
     */
    private async evictOldVideos(): Promise<void> {
        let totalSize = this.manifest.entries.reduce((sum, e) => sum + e.size, 0);

        if (totalSize <= MAX_CACHE_BYTES) return;

        // Sort by oldest access first
        const sorted = [...this.manifest.entries].sort(
            (a, b) => a.accessedAt - b.accessedAt,
        );

        for (const entry of sorted) {
            if (totalSize <= MAX_CACHE_BYTES) break;

            const filePath = `${CACHE_DIR}/${entry.filename}`;
            try {
                const exists = await RNFS.exists(filePath);
                if (exists) await RNFS.unlink(filePath);
            } catch { }

            totalSize -= entry.size;
            this.manifest.entries = this.manifest.entries.filter(
                (e) => e.url !== entry.url,
            );
        }

        await this.saveManifest();
    }

    /**
     * Clear entire video cache.
     */
    async clearAll(): Promise<void> {
        try {
            const exists = await RNFS.exists(CACHE_DIR);
            if (exists) {
                await RNFS.unlink(CACHE_DIR);
                await RNFS.mkdir(CACHE_DIR);
            }
            this.manifest = { entries: [] };
        } catch { }
    }

    /**
     * Get current cache size in bytes.
     */
    getCacheSize(): number {
        return this.manifest.entries.reduce((sum, e) => sum + e.size, 0);
    }

    // ── Helpers ──────────────────────────────────────────────────

    private urlToFilename(url: string): string {
        // Simple hash: use last path segment + timestamp suffix
        const parts = url.split('/');
        const basename = parts[parts.length - 1]?.split('?')[0] || 'video';
        const hash = this.simpleHash(url);
        // Preserve extension
        const ext = basename.includes('.') ? basename.split('.').pop() : 'mp4';
        return `${hash}.${ext}`;
    }

    private simpleHash(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    private async loadManifest(): Promise<void> {
        try {
            const exists = await RNFS.exists(MANIFEST_PATH);
            if (exists) {
                const json = await RNFS.readFile(MANIFEST_PATH, 'utf8');
                this.manifest = JSON.parse(json);
            }
        } catch {
            this.manifest = { entries: [] };
        }
    }

    private async saveManifest(): Promise<void> {
        try {
            await RNFS.writeFile(
                MANIFEST_PATH,
                JSON.stringify(this.manifest),
                'utf8',
            );
        } catch { }
    }
}

export const cacheService = new CacheService();
