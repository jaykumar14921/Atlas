import React, { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { InputComponent } from "../inputComponents/inputComponent";
import { NavBarComponent } from "../navBarComponents/navBarComponent";
import { FileExplorerComponent } from "../fileExplorerComponents/fileExplorerComponent";
import { useCacheManager } from "../../utils/useCacheManager";
import JSZip from "jszip";
import "./resultComponent.css";

export function CodeEditor() {
  const [themeImages, setThemeImages] = useState([]);
  const { compareVersions, undo, redo } = useCacheManager();
  const [changesInfo, setChangesInfo] = useState(null);
  const [showChangesModal, setShowChangesModal] = useState(false);
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
    <script></script>
  </body>
</html>`;

  const [code, setCode] = useState(defaultCode);
  const [editorWidth, setEditorWidth] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
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
  const [isFullscreen, setIsFullscreen] = useState(false); // Toggle for full-width preview
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const resizeTimeoutRef = useRef(null);

  // Toggle between split view and full-width preview
  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Download as ZIP functionality
  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();

      // Add all files to the zip
      generatedFiles.forEach(file => {
        zip.file(file.path, file.content);
      });

      // Generate the zip file
      const content = await zip.generateAsync({ type: "blob" });

      // Create download link
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = "atlas-project.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Clean up
      URL.revokeObjectURL(url);

      console.log("ZIP file downloaded successfully!");
    } catch (error) {
      console.error("Error creating ZIP file:", error);
      alert("Error downloading project files. Please try again.");
    }
  };

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  // Debounced resize handler to prevent ResizeObserver errors
  const debouncedLayout = () => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    
    resizeTimeoutRef.current = setTimeout(() => {
      if (editorRef.current) {
        try {
          editorRef.current.layout();
        } catch (error) {
          // Silently catch ResizeObserver errors
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
    
    // Suppress ResizeObserver errors globally
    const resizeObserverErrHandler = (e) => {
      if (e.message === 'ResizeObserver loop completed with undelivered notifications.' || 
          e.message.includes('ResizeObserver loop limit exceeded')) {
        e.stopImmediatePropagation();
        return false;
      }
    };
    
    window.addEventListener('error', resizeObserverErrHandler);
    window.addEventListener("resize", handleResize);
    
    return () => {
      window.removeEventListener('error', resizeObserverErrHandler);
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
      // Trigger layout after drag ends
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
      // Update layout in real-time for smooth dragging
      if (editorRef.current) {
        try {
          editorRef.current.layout();
        } catch (error) {
          // Silently catch ResizeObserver errors
          if (!error.message.includes('ResizeObserver')) {
            console.error('Editor layout error:', error);
          }
        }
      }
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

  const handleRefreshPreview = () => setRefreshKey((prev) => prev + 1);
  const handleDeviceChange = (mode) => setDeviceMode(mode);

  const handleFileSelect = (filePath, fileContent) => {
    setCurrentFile({ path: filePath, content: fileContent });
    setCode(fileContent);
    setShowFileExplorer(false);
  };

  const handleFileStructure = (files) => {
    const filteredFiles = files.filter(file => !file.isDefault);
    setGeneratedFiles(filteredFiles);
    if (filteredFiles.length > 0) {
      handleFileSelect(filteredFiles[0].path, filteredFiles[0].content);
    }
  };

  const handleSetCode = (newCode) => {
    setCode(newCode);
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
    setCurrentFile({
      path: "index.html",
      content: defaultCode
    });
    setCode(defaultCode);
  };

  useEffect(() => {
    if (code.includes('FILE_STRUCTURE:')) {
      try {
        const fileStructureMatch = code.match(/FILE_STRUCTURE:(\[.*?\])/);
        if (fileStructureMatch) {
          const files = JSON.parse(fileStructureMatch[1]);
          handleFileStructure(files);
          setCode(code.replace(/FILE_STRUCTURE:\[.*?\]/, '').trim());
        }
      } catch (error) {
        console.error('Error parsing file structure:', error);
      }
    }
  }, [code]);

  // Layout editor when width changes
  useEffect(() => {
    debouncedLayout();
  }, [editorWidth, isFullscreen]);

  let codeForPreview = code;
  const isFullHtml =
    code.trim().toLowerCase().startsWith("<!doctype") ||
    code.trim().toLowerCase().startsWith("<html");

  if (isFullHtml) {
    const style = `
      <style>
        body {
          display: flex !important;
          flex-direction: column !important;
          align-items: flex-start !important;
          justify-content: flex-start !important;
          padding: 1rem !important;
          height: auto !important;
          overflow: auto !important;
        }
      </style>`;
    if (code.match(/<\/head>/i)) {
      codeForPreview = code.replace(/<\/head>/i, `${style}</head>`);
    } else {
      codeForPreview = code.replace(/<body/i, `${style}<body`);
    }
  } else {
    codeForPreview = `
      <html>
        <head>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body>${code}</body>
      </html>
    `;
  }

  return (
     <div className="w-full flex flex-col" style={{ height: 'calc(100vh - 15px)' }}>
      <NavBarComponent
        onRefresh={handleRefreshPreview}
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
        {/* File Explorer Overlay */}
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

        {/* Left: Code Editor Section - Hidden in fullscreen mode */}
        {!isFullscreen && (
          <>
            <div
              className="relative flex flex-col border-r"
              style={{ width: `${editorWidth}%`, minHeight: 0 }}
            >
              {/* Editor Header Bar */}
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

              {/* Monaco Editor with Floating Copy Button - Full Height */}
              <div className="flex-grow overflow-auto min-h-0 relative" style={{ height: '100%' }}>
                {/* Floating Copy Button */}
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
                    automaticLayout: false, // Changed to false - we handle it manually
                    wordWrap: "on",
                  }}
                />
              </div>

              {/* Input Component - Floating at Bottom */}
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
                  setGeneratedFiles={setGeneratedFiles}
                />
              </div>
            </div>

            {/* Divider - Hidden in fullscreen mode */}
            <div
              className="cursor-col-resize h-full w-1 bg-gray-300 hover:bg-gray-400"
              onMouseDown={handleMouseDown}
            />
          </>
        )}

        {/* Right: Live Preview - Takes full width in fullscreen mode */}
        <div
          className={`flex-1 h-full min-h-0 flex justify-center items-center transition-all duration-300 relative ${isFullscreen ? 'fullscreen-preview' : ''
            }`}
          style={{
            width: isFullscreen ? '100%' : 'auto',
            backgroundColor: "#ffffffff",
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

              <iframe
                key={refreshKey}
                className="absolute top-0 left-0 rounded-[28px] transition-all duration-300"
                srcDoc={codeForPreview}
                title="mobile-preview"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  borderRadius: "28px",
                  background: "#fff",
                }}
                sandbox="allow-scripts allow-modals"
              />
            </div>
          ) : (
            <iframe
              key={refreshKey}
              className="w-full h-full border-none transition-all duration-300"
              srcDoc={codeForPreview}
              title="desktop-preview"
              sandbox="allow-scripts allow-modals"
            />
          )}
        </div>
      </div>
    </div>
  );
}
