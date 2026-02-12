import React, { useRef, useState, useEffect } from "react";
import logo from "../../assets/imgLogo.jpg";
import { useCacheManager } from "../../utils/useCacheManager";
import "./inputComponent.css";

export function InputComponent({ setCode, setThemeImages, setGeneratedFiles }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]);
  const [zipFiles, setZipFiles] = useState([]);
  const [cacheInfo, setCacheInfo] = useState(null);
  const [showCacheNotification, setShowCacheNotification] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [showUploadDropdown, setShowUploadDropdown] = useState(false);
  const fileRef = useRef(null);
  const imageRef = useRef(null);
  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);
  const abortControllerRef = useRef(null); // ✅ NEW: For aborting requests
  const { checkCache, storeInCache } = useCacheManager();

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

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

  const handleZipUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const validZipFiles = [];

    files.forEach((file) => {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        setErrorMessage("Please select valid ZIP files only");
        return;
      }

      const maxSize = 50 * 1024 * 1024;
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

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const imageFiles = [];
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    files.forEach((file) => {
      if (!file.type.startsWith('image/')) {
        setErrorMessage(`${file.name} is not an image file`);
        return;
      }

      if (!validTypes.includes(file.type.toLowerCase())) {
        setErrorMessage(`${file.name} has unsupported format. Please use JPEG, PNG, GIF, or WebP images only.`);
        return;
      }

      imageFiles.push({
        file: file,
        url: URL.createObjectURL(file),
        name: file.name,
      });
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

  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
    };
  }, []);

  const openZipPicker = () => {
    fileRef.current?.click();
  };

  const openImagePicker = () => {
    imageRef.current?.click();
  };

  const removeImageAt = (index) => {
    setImages((prev) => {
      const next = prev.slice();
      const [removed] = next.splice(index, 1);
      if (removed) URL.revokeObjectURL(removed.url);
      setThemeImages(next.map((img) => img.url));
      return next;
    });
  };

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

  // ✅ NEW: Function to stop/abort generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      console.log("🛑 Aborting generation...");
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setLoading(false);
      setErrorMessage("Generation stopped by user");
    }
  };

  // ✅ FIXED: Generate with immediate clearing and abort functionality
  const handleGenerate = async () => {
    // ✅ If already generating, stop it
    if (loading) {
      handleStopGeneration();
      return;
    }

    if (!prompt.trim()) {
      setErrorMessage("Please enter a prompt");
      return;
    }

    // ✅ CRITICAL: Clear inputs IMMEDIATELY when button is clicked
    const promptToGenerate = prompt;
    const imagesToGenerate = [...images];
    const zipFilesToGenerate = [...zipFiles];
    
    // Clear UI immediately
    setPrompt("");
    images.forEach((img) => URL.revokeObjectURL(img.url));
    setImages([]);
    setThemeImages([]);
    setZipFiles([]);
    if (fileRef.current) fileRef.current.value = "";
    if (imageRef.current) imageRef.current.value = "";

    setLoading(true);
    setErrorMessage(null);
    setCacheInfo(null);
    setCode("");

    // ✅ Create new AbortController for this request
    abortControllerRef.current = new AbortController();

    try {
      const imageHash = imagesToGenerate.length > 0 
        ? imagesToGenerate.map(img => `${img.name}-${img.file.size}`).join('|')
        : '';
      
      const zipHash = zipFilesToGenerate.length > 0 
        ? zipFilesToGenerate.map(zip => `zip:${zip.name}-${zip.file.size}`).join('|')
        : '';
      const fullHash = [imageHash, zipHash].filter(Boolean).join('||');
      
      // Check cache (skip if zip uploaded)
      if (zipFilesToGenerate.length === 0) {
        console.log("🔍 Checking cache for prompt...");
        const cacheResult = await checkCache(promptToGenerate, fullHash);

        if (cacheResult.cached) {
          console.log("✅ Found cached code!");
          setCacheInfo({
            fromCache: true,
            message: "Code loaded from cache (no re-generation needed)",
            cachedAt: new Date(cacheResult.timestamp).toLocaleString(),
          });
          setShowCacheNotification(true);

          setCode(cacheResult.code);
          if (cacheResult.files) {
            setGeneratedFiles(cacheResult.files);
          }

          setTimeout(() => setShowCacheNotification(false), 5000);
          setLoading(false);
          abortControllerRef.current = null;
          return;
        }
      }

      console.log(zipFilesToGenerate.length > 0 ? `📦 ${zipFilesToGenerate.length} ZIP file(s) uploaded, processing project...` : "📝 Code not cached, generating new code...");

      const formData = new FormData();
      formData.append('prompt', promptToGenerate);
      
      imagesToGenerate.forEach((img) => {
        formData.append('images', img.file);
      });

      if (zipFilesToGenerate.length > 0) {
        zipFilesToGenerate.forEach((zip) => {
          formData.append('projectZip', zip.file);
        });
      }

      console.log(`📤 Sending request with ${imagesToGenerate.length} image(s)${zipFilesToGenerate.length > 0 ? ` and ${zipFilesToGenerate.length} ZIP file(s)` : ''}`);

      const endpoint = zipFilesToGenerate.length > 0 ? '/generate-from-project' : '/generate-stream';

      // ✅ Use AbortController signal
      const response = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        body: formData,
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.status} ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let generatedCode = "";
      let fileStructure = [];

      // Stream chunks directly to editor
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });

        // Check for file structure
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

        const cleanChunk = chunk
          .replace(/FILE_STRUCTURE:.*/g, "")
          .replace(/data: /g, "")
          .trim();

        if (cleanChunk && !cleanChunk.includes("[DONE]")) {
          generatedCode += cleanChunk;
          setCode(prevCode => prevCode + cleanChunk);
        }
      }

      // Store in cache (only if not from zip)
      if (zipFilesToGenerate.length === 0) {
        console.log("💾 Storing code in cache...");
        await storeInCache(promptToGenerate, generatedCode, fileStructure, fullHash);
      }

      setCacheInfo({
        fromCache: false,
        message: zipFilesToGenerate.length > 0 ? "Project upgraded successfully" : "New code generated and cached successfully",
      });
      setShowCacheNotification(true);
      setTimeout(() => setShowCacheNotification(false), 5000);

      setLoading(false);
      abortControllerRef.current = null;
      
    } catch (error) {
      // ✅ Handle abort gracefully
      if (error.name === 'AbortError') {
        console.log("✅ Generation aborted successfully");
        setErrorMessage("Generation stopped");
        setLoading(false);
        abortControllerRef.current = null;
        return;
      }

      console.error("Generation error:", error);
      setErrorMessage(error.message || "Failed to generate code. Please try again.");
      setCacheInfo({
        fromCache: false,
        message: "Error during generation",
        error: error.message,
      });
      setLoading(false);
      abortControllerRef.current = null;
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
          <strong>
            {cacheInfo.fromCache ? "ℹ️ Cache Hit" : "✅ Success"}:
          </strong>{" "}
          {cacheInfo.message}
          {cacheInfo.cachedAt && (
            <small className="d-block mt-1">Cached: {cacheInfo.cachedAt}</small>
          )}
          <button
            type="button"
            className="btn-close"
            onClick={() => setShowCacheNotification(false)}
          ></button>
        </div>
      )}

      {/* Main Input Area */}
      <div className="input-container border rounded bg-dark">
        <textarea
          ref={textareaRef}
          className="form-control border-0 bg-dark text-white"
          placeholder="Describe what you want to create..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          disabled={loading}
          rows={3}
          style={{
            resize: "none",
            fontSize: "14px",
            lineHeight: "1.5",
          }}
          onKeyDown={(e) => {
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
          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
          multiple
          style={{ display: "none" }}
          onChange={handleImageUpload}
        />

        {/* ZIP Files Preview */}
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
            {/* Upload Drop-up */}
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
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'black'}
                    >
                      <i className="bi bi-link-45deg" style={{ fontSize: '1.1rem' }}></i>
                      <span>files/folders ZIP</span>
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
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#333'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'black'}
                    >
                      <i className="bi bi-image" style={{ fontSize: '1.1rem' }}></i>
                      <span>Images</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Image Previews */}
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

          {/* Right Side: Generate/Stop Button */}
          <button
            type="button"
            disabled={!loading && !prompt.trim()}
            className={`btn btn-sm ${loading ? 'btn-danger' : 'btn-primary'} generate-btn`}
            onClick={handleGenerate}
          >
            {loading ? (
              <>
                <i className="bi bi-stop-circle me-2"></i>
                Stop
              </>
            ) : (
              "Generate"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
