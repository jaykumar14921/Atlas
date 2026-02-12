// ==============================================
// SIMPLE FIX - NO SANDPACK REQUIRED
// Uses 3-second debounce pattern
// ==============================================

import React, { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { InputComponent } from "../inputComponents/inputComponent";
import { NavBarComponent } from "../navBarComponents/navBarComponent";
import { FileExplorerComponent } from "../fileExplorerComponents/fileExplorerComponent";
import JSZip from "jszip";
import "./resultComponent.css";

const defaultCode = `<!DOCTYPE html>
<html>
  <head>
    <title>My app</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta charset="utf-8">
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="flex justify-center items-center h-screen overflow-hidden bg-white font-sans text-center px-6">
    <div class="w-full" style="margin-top: 200px">
      <span class="text-xs rounded-full mb-2 inline-block px-2 py-1 border border-amber-500/15 bg-amber-500/15 text-amber-500">🔥 New version dropped!</span>
      <h1 class="text-4xl lg:text-6xl font-bold font-sans">
        <span class="text-2xl lg:text-4xl text-gray-400 block font-medium">I'm ready to work,</span>
        Ask me anything.
      </h1>
    </div>
    <img src="https://huggingface.co/deepsite/arrow.svg" class="absolute bottom-8 left-0 w-[100px] transform rotate-[30deg]" />
  </body>
</html>`;

export function CodeEditor() {
  const [themeImages, setThemeImages] = useState([]);
  
  // ✅ TWO SEPARATE STATES (Critical fix for flickering)
  const [code, setCode] = useState(defaultCode);              // For Monaco (immediate)
  const [previewCode, setPreviewCode] = useState(defaultCode); // For iframe (delayed)
  
  const [editorWidth, setEditorWidth] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [deviceMode, setDeviceMode] = useState("desktop");
  const [generatedFiles, setGeneratedFiles] = useState([
    {
      path: "index.html",
      content: defaultCode,
      isDefault: true
    }
  ]);
  const [currentFile, setCurrentFile] = useState({
    path: "index.html",
    content: defaultCode
  });
  const [showFileExplorer, setShowFileExplorer] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const resizeTimeoutRef = useRef(null);

  // ✅ 3-SECOND DEBOUNCE (Fixes flickering - Deepseek pattern)
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreviewCode(code);
      console.log('✅ Preview updated after 3s delay');
    }, 3000);

    return () => clearTimeout(timer);
  }, [code]);

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();
      generatedFiles.forEach(file => {
        zip.file(file.path, file.content);
      });
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "atlas-project.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      console.log("ZIP file downloaded successfully!");
    } catch (error) {
      console.error("Error creating ZIP file:", error);
      alert("Error downloading project files. Please try again.");
    }
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    console.log("✅ Monaco editor mounted");
  };

  const debouncedLayout = () => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      if (editorRef.current) {
        try {
          editorRef.current.layout();
        } catch (error) {
          if (!error.message.includes('ResizeObserver')) {
            console.error('Editor layout error:', error);
          }
        }
      }
    }, 100);
  };

  useEffect(() => {
    const handleResize = () => {
      debouncedLayout();
    };
    
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, []);

  const handleMouseDown = () => setIsDragging(true);
  
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      debouncedLayout();
    }
  };
  
  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current || isFullscreen) return;
    
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    const newWidth =
      ((e.clientX - containerRef.current.getBoundingClientRect().left) /
        containerWidth) *
      100;
    
    if (newWidth > 20 && newWidth < 80) {
      setEditorWidth(newWidth);
      debouncedLayout();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // ✅ UPDATE CODE STATE (Monaco shows immediately)
  const handleChange = (value) => {
    setCode(value);
    
    if (currentFile) {
      setGeneratedFiles(prev =>
        prev.map(file =>
          file.path === currentFile.path
            ? { ...file, content: value }
            : file
        )
      );
      setCurrentFile(prev => ({ ...prev, content: value }));
    }
  };

  const handleDeviceChange = (mode) => setDeviceMode(mode);

  const handleFileSelect = (filePath, fileContent) => {
    setCurrentFile({ path: filePath, content: fileContent });
    setCode(fileContent);
    setShowFileExplorer(false);
  };

  const handleFileStructure = (files) => {
    const hasRealFiles = files.some(f => !f.isDefault);
    
    if (hasRealFiles) {
      const filteredFiles = files.filter(file => !file.isDefault);
      setGeneratedFiles(filteredFiles);
      if (filteredFiles.length > 0) {
        handleFileSelect(filteredFiles[0].path, filteredFiles[0].content);
      }
    } else {
      setGeneratedFiles(files);
    }
  };

  // ✅ SET CODE FROM INPUT COMPONENT (During streaming)
  const handleSetCode = (newCode) => {
    setCode(newCode);  // Monaco updates immediately
    // Preview updates after 3s (via useEffect)
    
    setCurrentFile(prev => ({ ...prev, content: newCode }));
    setGeneratedFiles(prev =>
      prev.map(file =>
        file.path === currentFile.path
          ? { ...file, content: newCode }
          : file
      )
    );
  };

  const handleClearFiles = () => {
    setGeneratedFiles([
      {
        path: "index.html",
        content: defaultCode,
        isDefault: true
      }
    ]);
    setCurrentFile({ path: "index.html", content: defaultCode });
    setCode(defaultCode);
    setShowFileExplorer(false);
  };

  useEffect(() => {
    debouncedLayout();
  }, [editorWidth, isFullscreen]);

  return (
    <div className="w-full flex flex-col" style={{ height: 'calc(100vh - 15px)' }}>
      <NavBarComponent
        onRefresh={handleClearFiles}
        onDeviceChange={handleDeviceChange}
        onDownloadZip={handleDownloadZip}
        onToggleFullscreen={handleToggleFullscreen}
        isFullscreen={isFullscreen}
      />

      <div
        ref={containerRef}
        className="flex flex-row flex-grow w-full relative"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {showFileExplorer && !isFullscreen && (
          <div className="file-explorer-overlay">
            <FileExplorerComponent
              files={generatedFiles}
              onFileSelect={handleFileSelect}
              onRefresh={handleClearFiles}
              onClose={() => setShowFileExplorer(false)}
            />
          </div>
        )}

        {!isFullscreen && (
          <>
            <div
              className="relative flex flex-col border-r"
              style={{ width: `${editorWidth}%`, minHeight: 0 }}
            >
              <div className="bg-black editor-header d-flex justify-content-between align-items-center border-bottom">
                <div className="d-flex align-items-center">
                  {currentFile && (
                    <div className="current-file-info ms-3">
                      <span className="file-name-badge bg-dark">{currentFile.path}</span>
                    </div>
                  )}
                </div>

                <button
                  className="invert-btn btn btn-sm d-flex align-items-center gap-2 ms-2 me-2"
                  onClick={() => setShowFileExplorer(!showFileExplorer)}
                  title="File Explorer"
                >
                  <span className="bi bi-folder"></span>
                  Files
                </button>
              </div>

              <div className="flex-grow overflow-auto min-h-0 relative" style={{ height: '100%' }}>
                <button
                  id="btnCopy"
                  onClick={handleCopy}
                  className="floating-copy-btn btn btn-dark btn-sm d-flex align-items-center gap-1 me-4"
                  title={copied ? "Copied!" : "Copy code"}
                >
                  {copied ? (
                    <i className="bi bi-check2 bg-dark"></i>
                  ) : (
                    <i className="bi bi-link-45deg bg-dark"></i>
                  )}
                </button>

                {/* ✅ MONACO EDITOR - Updates immediately */}
                <Editor
                  height="100%"
                  width="100%"
                  defaultLanguage="html"
                  theme="vs-dark"
                  value={code}
                  onChange={handleChange}
                  onMount={handleEditorMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 16,
                    automaticLayout: false,
                    wordWrap: "on",
                  }}
                />
              </div>

              <div 
                id="inputComponent" 
                style={{ 
                  position: 'absolute', 
                  bottom: 0, 
                  left: 0, 
                  right: 0, 
                  zIndex: 10,
                  maxHeight: '50vh',
                  overflowY: 'auto'
                }}
              >
                <InputComponent
                  setCode={handleSetCode}
                  setThemeImages={setThemeImages}
                  setGeneratedFiles={handleFileStructure}
                />
              </div>
            </div>

            <div
              className="cursor-col-resize h-full w-1 bg-gray-300 hover:bg-gray-400"
              onMouseDown={handleMouseDown}
            />
          </>
        )}

        {/* ✅ IFRAME PREVIEW - Uses previewCode (delayed 3s) */}
        <div
          className={`flex-1 h-full min-h-0 flex justify-center items-center transition-all duration-300 relative ${isFullscreen ? 'fullscreen-preview' : ''}`}
          style={{
            width: isFullscreen ? '100%' : 'auto',
            backgroundColor: "#ffffff",
            backgroundImage:
              deviceMode !== "mobile" && themeImages.length
                ? `url(${themeImages[0]})`
                : "none",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {deviceMode === "mobile" ? (
            <div
              className="relative transition-all duration-300"
              style={{
                marginTop: "0px",
                width: "317px",
                height: "610px",
                borderRadius: "40px",
                border: "12px solid #222",
                boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                background: "#000",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: "120px",
                  height: "25px",
                  background: "#000",
                  borderRadius: "12px",
                  position: "absolute",
                  top: "8px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 10,
                }}
              ></div>

              {/* ✅ IFRAME - Uses previewCode (updates after 3s delay) */}
              <iframe
                srcDoc={previewCode}
                title="Mobile Preview"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "28px",
                }}
              />
            </div>
          ) : (
            // Desktop preview
            <iframe
              srcDoc={previewCode}
              title="Preview"
              sandbox="allow-scripts allow-forms allow-modals allow-popups"
              style={{
                width: "100%",
                height: "100%",
                border: "none",
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default CodeEditor;
