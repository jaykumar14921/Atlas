import React, { useRef, useState, useEffect } from "react";
import logo from "../../assets/imgLogo.jpg";
import { useCacheManager } from "../../utils/useCacheManager";
import "./inputComponent.css";

export function InputComponent({ setCode, setThemeImages, setGeneratedFiles }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]); // [{ file: File, url: string, name: string }]
  const [zipFiles, setZipFiles] = useState([]); // [{ file: File, name: string, size: string }]
  const [cacheInfo, setCacheInfo] = useState(null);
  const [showCacheNotification, setShowCacheNotification] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showUploadDropdown, setShowUploadDropdown] = useState(false);
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);
  const { checkCache, storeInCache, compareVersions } = useCacheManager();

  // ✅ API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUploadDropdown(false);
      }
    };

    if (showUploadDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showUploadDropdown]);

  // =====================
  // 🔹 Handle ZIP file upload (up to 4 files)
  // =====================
  const handleZipUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validZipFiles = [];

    files.forEach((file) => {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setErrorMessage("Please select valid ZIP files only");
        return;
      }

      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        setErrorMessage(`${file.name} is too large. Maximum size is 50MB`);
        return;
      }

      validZipFiles.push({
        file: file,
        name: file.name,
        size: file.size > 1024 * 1024 
          ? (file.size / (1024 * 1024)).toFixed(2) + ' MB'
          : (file.size / 1024).toFixed(2) + ' KB'
      });
    });

    if (validZipFiles.length > 0) {
      setZipFiles((prev) => {
        const updated = [...prev, ...validZipFiles];
        // Limit to 4 ZIP files
        if (updated.length > 4) {
          setErrorMessage("Maximum 4 ZIP files allowed");
          return updated.slice(0, 4);
        }
        return updated;
      });
      
      console.log(`✅ ${validZipFiles.length} ZIP file(s) selected`);
    }
    
    setShowUploadDropdown(false);
  };

  // =====================
  // 🔹 Handle image upload
  // =====================
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const imageFiles = [];

    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        imageFiles.push({
          file: file,
          url: URL.createObjectURL(file),
          name: file.name,
        });
      }
    });

    if (imageFiles.length > 0) {
      setImages((prev) => {
        const updated = [...prev, ...imageFiles];
        setThemeImages(updated.map((img) => img.url));
        return updated;
      });
    }

    setShowUploadDropdown(false);
  };

  // ✅ Cleanup URLs ONLY when component unmounts
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger file picker for ZIP
  const openZipPicker = () => {
    fileRef.current?.click();
  };

  // Trigger file picker for images
  const openImagePicker = () => {
    imageRef.current?.click();
  };

  // Remove a single image preview
  const removeImageAt = (index) => {
    setImages((prev) => {
      const next = prev.slice();
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      setThemeImages(next.map((img) => img.url));
      return next;
    });
  };

  // Remove a single zip file
  const removeZipAt = (index) => {
    setZipFiles((prev) => {
      const next = prev.slice();
      next.splice(index, 1);
      return next;
    });
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  };

  // =====================
  // 🔹 Handle code generation - single button for everything
  // =====================
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setErrorMessage("Please enter a prompt");
      return;
    }

    setLoading(true);
    setCode("");
    setCacheInfo(null);
    setErrorMessage(null);

    try {
      // ✅ Generate cache key that includes image and zip info
      const imageHash = images.length > 0 
        ? images.map(img => `${img.name}-${img.file.size}`).join('|')
        : '';
      
      const zipHash = zipFiles.length > 0 
        ? zipFiles.map(zip => `zip:${zip.name}-${zip.file.size}`).join('|')
        : '';
      const fullHash = [imageHash, zipHash].filter(Boolean).join('||');
      
      // Step 1: Check if code exists in cache (skip if zip is uploaded - always regenerate)
      if (zipFiles.length === 0) {
        console.log("🔍 Checking cache for prompt...");
        const cacheResult = await checkCache(prompt, fullHash);

        if (cacheResult.cached) {
          console.log("✅ Found cached code!");
          setCacheInfo({
            fromCache: true,
            message: "Code loaded from cache (no re-generation needed)",
            cachedAt: new Date(cacheResult.timestamp).toLocaleString(),
          });
          setShowCacheNotification(true);

          // Use cached code
          setCode(cacheResult.code);
          if (cacheResult.files) {
            setGeneratedFiles(cacheResult.files);
          }

          setTimeout(() => setShowCacheNotification(false), 5000);
          setLoading(false);
          return;
        }
      }

      // Step 2: Code not in cache or zip uploaded, generate new code
      console.log(zipFiles.length > 0 ? `📦 ${zipFiles.length} ZIP file(s) uploaded, processing project...` : "📝 Code not cached, generating new code...");

      // ✅ Create FormData to send prompt, images, and zip
      const formData = new FormData();
      formData.append('prompt', prompt);
      
      // ✅ Add all uploaded images using stored File objects
      images.forEach((img) => {
        formData.append('images', img.file);
      });

      // ✅ Add zip files if uploaded
      if (zipFiles.length > 0) {
        zipFiles.forEach((zip) => {
          formData.append('projectZip', zip.file);
        });
      }

      console.log(`📤 Sending request with ${images.length} image(s)${zipFiles.length > 0 ? ` and ${zipFiles.length} ZIP file(s)` : ''}`);

      // ✅ Choose endpoint based on whether zip is uploaded
      const endpoint = zipFiles.length > 0 ? '/generate-from-project' : '/generate-stream';

      // ✅ Send FormData
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let generatedCode = "";
      let fileStructure = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Check for file structure in the response
        if (chunk.includes("FILE_STRUCTURE:")) {
          const match = chunk.match(/FILE_STRUCTURE:(.*?)(?=\n\n|$)/);
          if (match) {
            try {
              fileStructure = JSON.parse(match[1]);
              console.log("📁 Files parsed:", fileStructure);
              setGeneratedFiles(fileStructure);
            } catch (e) {
              console.log("Could not parse file structure:", e);
            }
          }
        }

        // Filter out metadata and only keep actual code
        const cleanChunk = chunk
          .replace(/FILE_STRUCTURE:.*/g, "")
          .replace(/data: /g, "")
          .trim();

        if (cleanChunk && !cleanChunk.includes("[DONE]")) {
          generatedCode += cleanChunk;
          setCode((prev) => prev + cleanChunk);
        }
      }

      // Step 3: Store generated code in cache (only if not from zip)
      if (zipFiles.length === 0) {
        console.log("💾 Storing code in cache...");
        await storeInCache(prompt, generatedCode, fileStructure, fullHash);
      }

      setCacheInfo({
        fromCache: false,
        message: zipFiles.length > 0 ? "Project upgraded successfully" : "New code generated and cached successfully",
      });
      setShowCacheNotification(true);
      setTimeout(() => setShowCacheNotification(false), 5000);

      setLoading(false);
    } catch (error) {
      console.error("Generation error:", error);
      setErrorMessage(error.message || "Failed to generate code. Please try again.");
      setCacheInfo({
        fromCache: false,
        message: "Error during generation",
        error: error.message,
      });
      setLoading(false);
    }
  };

  return (
    <div className="input-wrapper mx-2 px-1">
      {/* Error Message */}
      {errorMessage && (
        <div
          className="alert alert-danger alert-dismissible fade show"
          role="alert"
          style={{ marginBottom: "10px", marginTop: "10px" }}
        >
          <strong>❌ Error:</strong> {errorMessage}
          <button
            type="button"
            className="btn-close"
            onClick={() => setErrorMessage(null)}
          ></button>
        </div>
      )}

      {/* Cache Notification */}
      {showCacheNotification && cacheInfo && (
        <div
          className={`alert ${
            cacheInfo.fromCache ? "alert-info" : "alert-success"
          } alert-dismissible fade show`}
          role="alert"
          style={{ marginBottom: "10px", marginTop: "10px" }}
        >
          <strong>{cacheInfo.fromCache ? "📦 Cache Hit!" : "💾 Success!"}</strong>{" "}
          {cacheInfo.message}
          {cacheInfo.cachedAt && (
            <small className="d-block">Cached: {cacheInfo.cachedAt}</small>
          )}
          <button
            type="button"
            className="btn-close"
            onClick={() => setShowCacheNotification(false)}
          ></button>
        </div>
      )}

      <div className="p-1">
        <textarea
          ref={textareaRef}
          className="form-control mt-1"
          placeholder={zipFiles.length > 0
            ? "Describe what you want to fix, upgrade, or complete in the project..." 
            : "Ask Atlas anything..."}
          rows="2"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            // ✅ Generate on Ctrl/Cmd + Enter
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              handleGenerate();
            }
          }}
        />

        {/* Hidden file inputs */}
        <input
          ref={fileRef}
          type="file"
          accept=".zip"
          multiple
          style={{ display: "none" }}
          onChange={handleZipUpload}
        />
        <input
          ref={imageRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />

        {/* ZIP Files Preview - Compact */}
        {zipFiles.length > 0 && (
          <div className="d-flex gap-1 mt-2" style={{ overflowX: 'auto', flexWrap: 'nowrap', maxWidth: '100%' }}>
            {zipFiles.map((zip, idx) => (
              <div 
                key={idx} 
                className="d-inline-flex align-items-center gap-1 px-2 py-1 border rounded"
                style={{ 
                  fontSize: '0.7rem', 
                  maxWidth: '140px',
                  minWidth: '120px',
                  backgroundColor: 'black',
                  color: 'white',
                  flexShrink: 0
                }}
              >
                <i className="bi bi-file-earmark-zip" style={{ fontSize: '0.85rem', color: 'white' }}></i>
                <span className="text-truncate" style={{ maxWidth: '80px' }} title={zip.name}>
                  {zip.name}
                </span>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  style={{ fontSize: '0.5rem', padding: '0.2rem' }}
                  onClick={() => removeZipAt(idx)}
                  disabled={loading}
                ></button>
              </div>
            ))}
          </div>
        )}

        {/* Upload + Previews + Generate Button */}
        <div className="input-actions d-flex align-items-center justify-content-between mt-3 flex-wrap">
          {/* Left Side: Upload Drop-up + Image Previews */}
          <div className="d-flex align-items-center gap-3 flex-wrap">
            {/* Upload Drop-up with "+" Button */}
            <div className="position-relative" ref={dropdownRef}>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary d-flex align-items-center justify-content-center"
                onClick={() => setShowUploadDropdown(!showUploadDropdown)}
                disabled={loading}
                title="Upload files"
                style={{ 
                  backgroundColor: 'black',
                  width: '32px', 
                  height: '32px',
                  padding: '0',
                  fontSize: '18px',
                  fontWeight: 'bold'
                }}
              >
                +
              </button>

              {/* Drop-up Menu */}
              {showUploadDropdown && (
                <div 
                  className="border rounded shadow-sm"
                  style={{
                    backgroundColor: 'black',
                    bottom: '100%',
                    left: '0',
                    marginBottom: '1px',
                    minWidth: '170px',
                    zIndex: 1000,
                    position: 'absolute'
                  }}
                >
                  <div className="list-group list-group-flush">
                    <button
                      type="button"
                      className="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2"
                      onClick={openZipPicker}
                      disabled={loading}
                      style={{ 
                        fontSize: '0.9rem', 
                        backgroundColor: 'black',
                        color: 'white',
                        border: 'none',
                        transition: 'background-color 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#333';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'black';
                      }}
                    >
                      <i className="bi bi-link-45deg" style={{ fontSize: '1.1rem', color: 'inherit' }}></i>
                      <span style={{ color: 'inherit' }}>files/folders ZIP</span>
                    </button>
                    <button
                      type="button"
                      className="list-group-item list-group-item-action d-flex align-items-center gap-2 py-2"
                      onClick={openImagePicker}
                      disabled={loading}
                      style={{ 
                        fontSize: '0.9rem', 
                        backgroundColor: 'black',
                        color: 'white',
                        border: 'none',
                        transition: 'background-color 0.2s ease',
                        cursor: 'pointer'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = '#333';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'black';
                      }}
                    >
                      <i className="bi bi-image" style={{ fontSize: '1.1rem', color: 'inherit' }}></i>
                      <span style={{ color: 'inherit' }}>Images</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Image Previews - 2px smaller */}
            {images.length > 0 && (
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {images.slice(0, 3).map((img, idx) => (
                  <div key={idx} className="preview-box" style={{ width: '38px', height: '38px' }}>
                    <img
                      src={img.url}
                      alt={`preview-${idx}`}
                      className="preview-img"
                      style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }}
                    />
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeImageAt(idx)}
                      disabled={loading}
                      style={{
                        position: 'absolute',
                        top: '-4px',
                        right: '-4px',
                        width: '16px',
                        height: '16px',
                        fontSize: '10px',
                        padding: '0',
                        lineHeight: '1'
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {images.length > 3 && (
                  <div
                    className="preview-more"
                    title={`${images.length - 3} more image(s)`}
                    style={{
                      width: '38px',
                      height: '38px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem'
                    }}
                  >
                    +{images.length - 3}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Side: Single Generate Button */}
          <button
            type="button"
            disabled={loading || !prompt.trim()}
            className="btn btn-sm btn-primary generate-btn"
            onClick={handleGenerate}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                {zipFiles.length > 0 ? "Processing..." : "Generating..."}
              </>
            ) : (
              "Generate"
            )}
          </button>
        </div>

        {/* Helper text
        <small className="text-muted d-block mt-2">
          {zipFile && "📦 Project loaded • "}
          {images.length > 0 && `${images.length} image(s) selected • `}
          Press Ctrl+Enter to generate
        </small> */}
      </div>
    </div>
  );
}
