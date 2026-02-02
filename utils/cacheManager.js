/**
 * Code Cache Manager
 * Handles code storage, retrieval, and differential updates
 * Prevents redundant code regeneration and enables efficient updates
 */

class CacheManager {
  constructor() {
    // In-memory cache: Map of prompt_hash -> { timestamp, code, files, prompt }
    this.cache = new Map();
    // History for user sessions: Map of sessionId -> { entries: [...], currentIndex }
    this.sessionHistory = new Map();
  }

  /**
   * Generate a hash for a prompt to use as cache key
   * @param {string} prompt - The user's prompt
   * @param {string} imageAnalysis - The image analysis from AI
   * @returns {string} Hash key
   */
  generateCacheKey(prompt, imageAnalysis = "") {
    const combined = `${prompt}|${imageAnalysis}`;
    return btoa(combined).replace(/[+/=]/g, (m) => {
      return { "+": "-", "/": "_", "=": "" }[m];
    });
  }

  /**
   * Store code in cache
   * @param {string} cacheKey - The cache key
   * @param {string} code - The generated code
   * @param {Array} files - Generated file structure
   * @param {string} prompt - Original prompt
   * @returns {Object} Cache entry
   */
  setCacheEntry(cacheKey, code, files, prompt) {
    const entry = {
      timestamp: Date.now(),
      code,
      files: files || [],
      prompt,
      hash: this.generateCodeHash(code),
    };

    this.cache.set(cacheKey, entry);
    return entry;
  }

  /**
   * Retrieve code from cache
   * @param {string} cacheKey - The cache key
   * @returns {Object|null} Cache entry or null if not found
   */
  getCacheEntry(cacheKey) {
    return this.cache.get(cacheKey) || null;
  }

  /**
   * Check if code exists in cache
   * @param {string} cacheKey - The cache key
   * @returns {boolean}
   */
  isCached(cacheKey) {
    return this.cache.has(cacheKey);
  }

  /**
   * Generate a simple hash of the code for comparison
   * @param {string} code - The code to hash
   * @returns {string} Hash string
   */
  generateCodeHash(code) {
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      const char = code.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Compare two code versions and find differences
   * Used for efficient partial updates
   * @param {string} oldCode - Previous code version
   * @param {string} newCode - New code version
   * @returns {Object} Diff information including changes
   */
  generateDiff(oldCode, newCode) {
    if (oldCode === newCode) {
      return {
        hasDifferences: false,
        oldHash: this.generateCodeHash(oldCode),
        newHash: this.generateCodeHash(newCode),
        changes: [],
      };
    }

    // Split into lines for line-by-line comparison
    const oldLines = oldCode.split("\n");
    const newLines = newCode.split("\n");
    const changes = [];

    // Simple diff algorithm: find changed lines
    const maxLines = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || "";
      const newLine = newLines[i] || "";

      if (oldLine !== newLine) {
        changes.push({
          lineNumber: i + 1,
          type: oldLine === "" ? "add" : newLine === "" ? "remove" : "modify",
          oldContent: oldLine,
          newContent: newLine,
        });
      }
    }

    return {
      hasDifferences: true,
      oldHash: this.generateCodeHash(oldCode),
      newHash: this.generateCodeHash(newCode),
      changes,
      changedLinesCount: changes.length,
      totalLines: newLines.length,
    };
  }

  /**
   * Compare files and identify which ones have changed
   * @param {Array} oldFiles - Previous file structure
   * @param {Array} newFiles - New file structure
   * @returns {Object} File comparison results
   */
  compareFiles(oldFiles, newFiles) {
    const comparison = {
      added: [],
      modified: [],
      removed: [],
      unchanged: [],
    };

    const oldFileMap = new Map(oldFiles.map((f) => [f.path, f]));
    const newFileMap = new Map(newFiles.map((f) => [f.path, f]));

    // Check for modified and unchanged files
    for (const [path, newFile] of newFileMap) {
      const oldFile = oldFileMap.get(path);
      if (!oldFile) {
        comparison.added.push({
          path,
          content: newFile.content,
          language: newFile.language,
        });
      } else if (oldFile.content !== newFile.content) {
        comparison.modified.push({
          path,
          oldContent: oldFile.content,
          newContent: newFile.content,
          diff: this.generateDiff(oldFile.content, newFile.content),
        });
      } else {
        comparison.unchanged.push(path);
      }
    }

    // Check for removed files
    for (const [path, oldFile] of oldFileMap) {
      if (!newFileMap.has(path)) {
        comparison.removed.push({
          path,
          content: oldFile.content,
        });
      }
    }

    return {
      hasChanges:
        comparison.added.length > 0 ||
        comparison.modified.length > 0 ||
        comparison.removed.length > 0,
      summary: {
        addedCount: comparison.added.length,
        modifiedCount: comparison.modified.length,
        removedCount: comparison.removed.length,
        unchangedCount: comparison.unchanged.length,
      },
      details: comparison,
    };
  }

  /**
   * Store a code version in session history for undo/redo functionality
   * @param {string} sessionId - User session ID
   * @param {string} code - The code
   * @param {Array} files - File structure
   * @param {string} prompt - The prompt used
   */
  addToHistory(sessionId, code, files, prompt) {
    if (!this.sessionHistory.has(sessionId)) {
      this.sessionHistory.set(sessionId, {
        entries: [],
        currentIndex: -1,
      });
    }

    const history = this.sessionHistory.get(sessionId);

    // Remove any redo entries after current index
    history.entries = history.entries.slice(0, history.currentIndex + 1);

    // Add new entry
    history.entries.push({
      timestamp: Date.now(),
      code,
      files,
      prompt,
    });

    history.currentIndex = history.entries.length - 1;
  }

  /**
   * Undo to previous version in history
   * @param {string} sessionId - User session ID
   * @returns {Object|null} Previous version or null if at beginning
   */
  undo(sessionId) {
    const history = this.sessionHistory.get(sessionId);
    if (!history || history.currentIndex <= 0) return null;

    history.currentIndex--;
    return history.entries[history.currentIndex];
  }

  /**
   * Redo to next version in history
   * @param {string} sessionId - User session ID
   * @returns {Object|null} Next version or null if at end
   */
  redo(sessionId) {
    const history = this.sessionHistory.get(sessionId);
    if (!history || history.currentIndex >= history.entries.length - 1)
      return null;

    history.currentIndex++;
    return history.entries[history.currentIndex];
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache info
   */
  getCacheStats() {
    return {
      totalEntries: this.cache.size,
      totalSessions: this.sessionHistory.size,
      cacheKeys: Array.from(this.cache.keys()),
      oldestEntry:
        this.cache.size > 0
          ? Math.min(
              ...Array.from(this.cache.values()).map((e) => e.timestamp)
            )
          : null,
      newestEntry:
        this.cache.size > 0
          ? Math.max(
              ...Array.from(this.cache.values()).map((e) => e.timestamp)
            )
          : null,
    };
  }

  /**
   * Clear cache (optional cleanup)
   * @param {number} olderThanMs - Clear entries older than this timestamp (optional)
   */
  clearCache(olderThanMs = null) {
    if (!olderThanMs) {
      this.cache.clear();
      return;
    }

    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > olderThanMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Get partial update instructions instead of full code
   * Useful for displaying what changed
   * @param {Object} oldFiles - Previous files
   * @param {Object} newFiles - New files
   * @returns {Object} Update instructions
   */
  getUpdateInstructions(oldFiles, newFiles) {
    const comparison = this.compareFiles(oldFiles, newFiles);

    return {
      applyChanges: comparison.hasChanges,
      instructions: {
        files: comparison.details,
        summary: comparison.summary,
        message: this.generateUpdateMessage(comparison),
      },
    };
  }

  /**
   * Generate a human-readable message about what changed
   * @param {Object} comparison - Comparison result
   * @returns {string} Readable message
   */
  generateUpdateMessage(comparison) {
    const { added, modified, removed } = comparison.details;
    const messages = [];

    if (added.length > 0) {
      messages.push(`📄 Added ${added.length} file(s)`);
    }
    if (modified.length > 0) {
      messages.push(`✏️  Modified ${modified.length} file(s)`);
    }
    if (removed.length > 0) {
      messages.push(`🗑️  Removed ${removed.length} file(s)`);
    }

    return (
      messages.join(" • ") || "✅ Code matches previous version (no changes)"
    );
  }
}

// Export singleton instance
const cacheManager = new CacheManager();
export default cacheManager;
