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
import arrow from '../../assets/curry_arrow_icon.png';

const defaultCode = `<!DOCTYPE html>
<html>
  <head>
    <title>My app</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta charset="utf-8">
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="flex justify-center items-center h-screen overflow-hidden bg-white font-sans text-center px-6">
    <div class="w-full" style="margin-top: 60px">
      <span class="text-xs rounded-full mb-2 inline-block px-2 py-1 border border-amber-500/15 bg-amber-500/15 text-amber-500">🔥 New version dropped!</span>
      <h1 class="text-4xl lg:text-6xl font-bold font-sans">
        <span class="text-2xl lg:text-4xl text-gray-400 block font-medium">I'm ready to work,</span>
        Ask me anything.
      </h1>
    </div>
    <img src=${arrow} class="absolute bottom-8 left-0 w-[100px] transform rotate-[30deg]" />
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
  
  // ✅ NEW: Streaming state to control debounce behavior
  const [isStreaming, setIsStreaming] = useState(false);
  
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const resizeTimeoutRef = useRef(null);
  const iframeRef = useRef(null);
  const previewUpdateTimerRef = useRef(null);

  // ✅ IMPROVED DEBOUNCE LOGIC
  // - During streaming: Updates every 3 seconds to avoid flickering
  // - After streaming ends: Immediate final update
  // - Manual edits: 1-second debounce for responsive editing
  useEffect(() => {
    console.log(`[PREVIEW] Code length: ${code.length}, isStreaming: ${isStreaming}`);

    // During streaming, only start timer if there isn't one already running
    if (isStreaming) {
      if (!previewUpdateTimerRef.current) {
        console.log('[TIMER] Starting new 3-second timer during streaming');
        previewUpdateTimerRef.current = setTimeout(() => {
          setPreviewCode(code);
          console.log(`✅ Preview updated during streaming (3s delay) - ${code.length} chars`);
          previewUpdateTimerRef.current = null; // Clear ref so next update can start
        }, 3000);
      }
    } else {
      // Not streaming - clear any existing timer and start a 1-second one
      if (previewUpdateTimerRef.current) {
        clearTimeout(previewUpdateTimerRef.current);
      }
      previewUpdateTimerRef.current = setTimeout(() => {
        setPreviewCode(code);
        console.log(`✅ Preview updated (1s delay) - ${code.length} chars`);
        previewUpdateTimerRef.current = null;
      }, 1000);
    }

    return () => {
      // Only clear on unmount, not on every code change during streaming
      if (!isStreaming && previewUpdateTimerRef.current) {
        clearTimeout(previewUpdateTimerRef.current);
      }
    };
  }, [code, isStreaming]);

  // ✅ NEW: Immediate preview update when streaming stops
  useEffect(() => {
    if (!isStreaming) {
      // Clear any running timer
      if (previewUpdateTimerRef.current) {
        clearTimeout(previewUpdateTimerRef.current);
        previewUpdateTimerRef.current = null;
      }
      // Immediate update with final code
      setPreviewCode(code);
      console.log(`✅ Final preview update (streaming ended) - ${code.length} chars`);
    }
  }, [isStreaming,code]);

  const handleToggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleDownloadZip = async () => {
    try {
      const zip = new JSZip();
      
      // Check if generatedFiles has actual content
      const hasContent = generatedFiles.some(file => file.content && file.content.length > 0);
      
      if (!hasContent && code) {
        // Fallback: use the code state if generatedFiles is empty
        console.log('⚠️ generatedFiles empty, using code state for download');
        zip.file('index.html', code);
      } else {
        // Use generatedFiles
        generatedFiles.forEach(file => {
          if (file.content) {
            zip.file(file.path, file.content);
          }
        });
      }
      
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

  // ✅ NEW: Proper iframe refresh function
  const handleRefreshPreview = () => {
    console.log('🔄 Refreshing iframe preview...');
    
    // Force iframe reload by temporarily clearing and restoring srcDoc
    if (iframeRef.current) {
      const currentSrcDoc = iframeRef.current.srcdoc;
      iframeRef.current.srcdoc = '';
      
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.srcdoc = currentSrcDoc;
          console.log('✅ Iframe refreshed');
        }
      }, 50);
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
    // Safety check - ensure files is an array
    if (!Array.isArray(files)) {
      console.error('handleFileStructure received non-array:', files);
      return;
    }
    
    const hasRealFiles = files.some(f => !f.isDefault);
    
    if (hasRealFiles) {
      const filteredFiles = files.filter(file => !file.isDefault);
      setGeneratedFiles(filteredFiles);
      
      // Update current file if it exists in new structure
      const currentInNew = filteredFiles.find(f => f.path === currentFile.path);
      if (currentInNew) {
        handleFileSelect(currentInNew.path, currentInNew.content);
      } else if (filteredFiles.length > 0) {
        handleFileSelect(filteredFiles[0].path, filteredFiles[0].content);
      }
    } else {
      setGeneratedFiles(files);
    }
  };

  // ✅ IMPROVED: Code updates from streaming with live file explorer support
  const handleSetCode = (newCode, streamingState = false, shouldUpdateFiles = true) => {
    setCode(newCode);
    setIsStreaming(streamingState);
    
    setCurrentFile(prev => ({ ...prev, content: newCode }));
    
    // ✅ Update generatedFiles to keep file explorer in sync
    // Only update if shouldUpdateFiles is true (avoid conflicts during streaming)
    if (shouldUpdateFiles && currentFile) {
      setGeneratedFiles(prev =>
        prev.map(file =>
          file.path === currentFile.path
            ? { ...file, content: newCode }
            : file
        )
      );
    }
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
    setPreviewCode(defaultCode);
    setShowFileExplorer(false);
    setIsStreaming(false);
    console.log('🗑️ All files cleared, reset to default');
  };

  useEffect(() => {
    debouncedLayout();
  }, [editorWidth, isFullscreen]);

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
        className="flex flex-row w-full relative"
        style={{ 
          height: 'calc(100vh - 75px)', // Fixed height minus navbar
          overflow: 'hidden' // Prevent container from scrolling
        }}
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
              style={{ 
                width: `${editorWidth}%`, 
                height: '100%', // Take full height of parent
                overflow: 'hidden' // Prevent this column from scrolling
              }}
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

              <div 
                className="relative" 
                style={{ 
                  height: 'calc(100% - 40px)', // Full height minus header
                  overflow: 'hidden', // Monaco handles its own scrolling
                  display: 'flex',
                  flexDirection: 'column'
                }}
              >
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
                  setIsStreaming={setIsStreaming}  
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
          className={`flex justify-center items-center transition-all duration-300 relative ${isFullscreen ? 'fullscreen-preview' : ''}`}
          style={{
            width: isFullscreen ? '100%' : 'auto',
            height: '100%', // Fixed height
            flex: isFullscreen ? 'none' : 1, // Flex grow when not fullscreen
            overflow: 'auto', // Enable scrolling for the preview container
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
            <div style={{ 
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: '100%',
              height: '100%', // Use full container height
              overflow: 'hidden' // Prevent expansion
            }}>
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

              {/* ✅ IFRAME - Uses previewCode (updates after delay) */}
              <iframe
                ref={iframeRef}
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
            </div>
          ) : (
            // Desktop preview - wrapped in fixed container to prevent expansion
            <div style={{ 
              width: '100%', 
              height: '100%', // Fixed height from parent
              overflow: 'hidden' // Iframe manages its own scroll
            }}>
              <iframe
                ref={iframeRef}
                srcDoc={previewCode}
                title="Preview"
                sandbox="allow-scripts allow-forms allow-modals allow-popups"
                style={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default CodeEditor;
