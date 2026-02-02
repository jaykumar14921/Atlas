import React, { useRef, useState, useEffect } from "react";
import logo from "../../assets/imgLogo.jpg";
import { useCacheManager } from "../../utils/useCacheManager";
import "./inputComponent.css";

export function InputComponent({ setCode, setThemeImages, setGeneratedFiles }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]); // [{ file: File, url: string, name: string }]
  const [zipFile, setZipFile] = useState(null); // { file: File, name: string, size: string }
  const [cacheInfo, setCacheInfo] = useState(null);
  const [showCacheNotification, setShowCacheNotification] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const fileRef = useRef(null);
  const textareaRef = useRef(null);
  const { checkCache, storeInCache, compareVersions } = useCacheManager();

  // ✅ API URL from environment variable
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  // =====================
  // 🔹 Handle file upload (images AND zip in one input)
  // =====================
  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const imageFiles = [];
    let zipFileFound = null;

    files.forEach((file) => {
      // Check if it's a ZIP file
      if (file.name.toLowerCase().endsWith('.zip')) {
        // Validate file size (max 50MB)
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
          setErrorMessage("ZIP file is too large. Maximum size is 50MB");
          return;
        }
        zipFileFound = {
          file: file,
          name: file.name,
          size: (file.size / 1024).toFixed(2) + ' KB'
        };
        console.log(`✅ ZIP file selected: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`);
      } 
      // Check if it's an image
      else if (file.type.startsWith('image/')) {
        imageFiles.push({
          file: file,
          url: URL.createObjectURL(file),
          name: file.name,
        });
      }
    });

    // Update state with images
    if (imageFiles.length > 0) {
      setImages((prev) => {
        const updated = [...prev, ...imageFiles];
        setThemeImages(updated.map((img) => img.url));
        return updated;
      });
    }

    // Update state with ZIP (only one ZIP at a time)
    if (zipFileFound) {
      setZipFile(zipFileFound);
    }
  };

  // ✅ Cleanup URLs ONLY when component unmounts
  useEffect(() => {
    return () => {
      images.forEach((img) => URL.revokeObjectURL(img.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger file picker
  const openFilePicker = () => {
    fileRef.current?.click();
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

  // Remove zip file
  const removeZipFile = () => {
    setZipFile(null);
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
      
      const zipHash = zipFile ? `zip:${zipFile.name}-${zipFile.file.size}` : '';
      const fullHash = [imageHash, zipHash].filter(Boolean).join('||');
      
      // Step 1: Check if code exists in cache (skip if zip is uploaded - always regenerate)
      if (!zipFile) {
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
      console.log(zipFile ? "📦 ZIP file uploaded, processing project..." : "📝 Code not cached, generating new code...");

      // ✅ Create FormData to send prompt, images, and zip
      const formData = new FormData();
      formData.append('prompt', prompt);
      
      // ✅ Add all uploaded images using stored File objects
      images.forEach((img) => {
        formData.append('images', img.file);
      });

      // ✅ Add zip file if uploaded
      if (zipFile) {
        formData.append('projectZip', zipFile.file);
      }

      console.log(`📤 Sending request with ${images.length} image(s)${zipFile ? ' and 1 ZIP file' : ''}`);

      // ✅ Choose endpoint based on whether zip is uploaded
      const endpoint = zipFile ? '/generate-from-project' : '/generate-stream';

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
      if (!zipFile) {
        console.log("💾 Storing code in cache...");
        await storeInCache(prompt, generatedCode, fileStructure, fullHash);
      }

      setCacheInfo({
        fromCache: false,
        message: zipFile ? "Project upgraded successfully" : "New code generated and cached successfully",
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
          placeholder={zipFile 
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

        {/* Hidden file input - accepts both images and ZIP */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*,.zip"
          multiple
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />

        {/* ZIP File Preview */}
        {zipFile && (
          <div className="zip-preview mt-2 p-2 border rounded bg-light d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2">
              <i className="bi bi-file-zip-fill text-primary fs-4"></i>
              <div>
                <div className="fw-bold small">{zipFile.name}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{zipFile.size}</div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={removeZipFile}
              disabled={loading}
            >
              <i className="bi bi-x-lg"></i>
            </button>
          </div>
        )}

        {/* Upload + Previews + Generate Button */}
        <div className="input-actions d-flex align-items-center justify-content-between mt-3 flex-wrap">
          {/* Left Side: Upload Button + Image Previews */}
          <div className="d-flex align-items-center gap-3 flex-wrap">
            {/* Single Upload Button for Images & ZIP */}
            <button
              type="button"
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"
              onClick={openFilePicker}
              disabled={loading}
              title="Upload images or project ZIP"
            >
              <img
                src={logo}
                alt="upload-icon"
                style={{ width: 18, height: 18, borderRadius: 4 }}
              />
              Upload Files
            </button>

            {/* Image Previews */}
            {images.length > 0 && (
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {images.slice(0, 3).map((img, idx) => (
                  <div key={idx} className="preview-box">
                    <img
                      src={img.url}
                      alt={`preview-${idx}`}
                      className="preview-img"
                    />
                    <button
                      type="button"
                      className="remove-btn"
                      onClick={() => removeImageAt(idx)}
                      disabled={loading}
                    >
                      ×
                    </button>
                  </div>
                ))}
                {images.length > 3 && (
                  <div
                    className="preview-more"
                    title={`${images.length - 3} more image(s)`}
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
                {zipFile ? "Processing..." : "Generating..."}
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
