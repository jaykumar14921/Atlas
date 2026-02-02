import { useCallback } from 'react';

/**
 * Custom hook for managing code cache
 * Provides functions to check, store, and compare cached code
 */
export const useCacheManager = () => {
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  /**
   * Check if code exists in cache
   * @param {string} prompt - User's prompt
   * @param {string} imageHash - Optional hash of images (for cache key)
   * @returns {Promise<Object>} Cache result
   */
  const checkCache = useCallback(async (prompt, imageHash = '') => {
    try {
      const response = await fetch(`${API_URL}/cache/check`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          imageAnalysis: imageHash, // Use imageHash as part of cache key
        }),
      });

      if (!response.ok) {
        console.error('Cache check failed:', response.status);
        return { cached: false };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error checking cache:', error);
      return { cached: false };
    }
  }, [API_URL]);

  /**
   * Store code in cache
   * @param {string} prompt - User's prompt
   * @param {string} code - Generated code
   * @param {Array} files - Generated file structure
   * @param {string} imageHash - Optional hash of images
   * @returns {Promise<Object>} Store result
   */
  const storeInCache = useCallback(async (prompt, code, files = [], imageHash = '') => {
    try {
      const response = await fetch(`${API_URL}/cache/store`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          code,
          files,
          imageAnalysis: imageHash,
        }),
      });

      if (!response.ok) {
        console.error('Cache store failed:', response.status);
        return { success: false };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error storing in cache:', error);
      return { success: false };
    }
  }, [API_URL]);

  /**
   * Compare two code versions
   * @param {string} oldCode - Previous code
   * @param {string} newCode - New code
   * @param {Array} oldFiles - Previous file structure
   * @param {Array} newFiles - New file structure
   * @returns {Promise<Object>} Comparison result
   */
  const compareVersions = useCallback(async (oldCode, newCode, oldFiles = [], newFiles = []) => {
    try {
      const response = await fetch(`${API_URL}/cache/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          oldCode,
          newCode,
          oldFiles,
          newFiles,
        }),
      });

      if (!response.ok) {
        console.error('Version comparison failed:', response.status);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error comparing versions:', error);
      return null;
    }
  }, [API_URL]);

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache stats
   */
  const getCacheStats = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/cache/stats`);

      if (!response.ok) {
        console.error('Failed to get cache stats:', response.status);
        return null;
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }, [API_URL]);

  /**
   * Clear cache
   * @param {number} olderThanMs - Optional: clear entries older than this (in ms)
   * @returns {Promise<Object>} Clear result
   */
  const clearCache = useCallback(async (olderThanMs = null) => {
    try {
      const response = await fetch(`${API_URL}/cache/clear`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          olderThanMs,
        }),
      });

      if (!response.ok) {
        console.error('Cache clear failed:', response.status);
        return { success: false };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return { success: false };
    }
  }, [API_URL]);

  /**
   * Add version to history (for undo/redo)
   * @param {string} sessionId - User session ID
   * @param {string} code - Code to add
   * @param {Array} files - File structure
   * @param {string} prompt - Original prompt
   * @returns {Promise<Object>} Result
   */
  const addToHistory = useCallback(async (sessionId, code, files = [], prompt = '') => {
    try {
      const response = await fetch(`${API_URL}/cache/history/add`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          code,
          files,
          prompt,
        }),
      });

      if (!response.ok) {
        console.error('Failed to add to history:', response.status);
        return { success: false };
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error adding to history:', error);
      return { success: false };
    }
  }, [API_URL]);

  /**
   * Undo to previous version
   * @param {string} sessionId - User session ID
   * @returns {Promise<Object>} Previous version or null
   */
  const undo = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/cache/history/undo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        console.error('Undo failed:', response.status);
        return null;
      }

      const data = await response.json();
      return data.success ? data.version : null;
    } catch (error) {
      console.error('Error during undo:', error);
      return null;
    }
  }, [API_URL]);

  /**
   * Redo to next version
   * @param {string} sessionId - User session ID
   * @returns {Promise<Object>} Next version or null
   */
  const redo = useCallback(async (sessionId) => {
    try {
      const response = await fetch(`${API_URL}/cache/history/redo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        console.error('Redo failed:', response.status);
        return null;
      }

      const data = await response.json();
      return data.success ? data.version : null;
    } catch (error) {
      console.error('Error during redo:', error);
      return null;
    }
  }, [API_URL]);

  return {
    checkCache,
    storeInCache,
    compareVersions,
    getCacheStats,
    clearCache,
    addToHistory,
    undo,
    redo,
  };
};
