import React, { useState, useRef, useEffect } from "react";
import Editor from "@monaco-editor/react";
import { InputComponent } from "../inputComponents/inputComponent";
import { NavBarComponent } from "../navBarComponents/navBarComponent";
import "./resultComponent.css";



export function CodeEditor() {
  const [themeImages, setThemeImages] = useState([]);
  const [code, setCode] = useState(`<!DOCTYPE html>
<html>
  <head>
    <title>My app</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta charset="utf-8">
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body class="flex justify-center items-center h-screen overflow-hidden bg-white font-sans text-center px-6">
    <div class="w-full">
      <span class="text-xs rounded-full mb-2 inline-block px-2 py-1 border border-amber-500/15 bg-amber-500/15 text-amber-500">🔥 New version dropped!</span>
      <h1 class="text-4xl lg:text-6xl font-bold font-sans">
        <span class="text-2xl lg:text-4xl text-gray-400 block font-medium">I'm ready to work,</span>
        Ask me anything.
      </h1>
    </div>
      <img src="https://huggingface.co/deepsite/arrow.svg" class="absolute bottom-8 left-0 w-[100px] transform rotate-[30deg]" />
    <script></script>
  </body>
</html>
`);

  const [editorWidth, setEditorWidth] = useState(40);
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [deviceMode, setDeviceMode] = useState("desktop"); // 🔄 NEW: device toggle
  const containerRef = useRef(null);
  const editorRef = useRef(null);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;
  };

  useEffect(() => {
  const handleResize = () => {
    requestAnimationFrame(() => editorRef.current?.layout());
  };
  window.addEventListener("resize", handleResize);
  return () => window.removeEventListener("resize", handleResize);
}, []);

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => setIsDragging(false);
  const handleMouseMove = (e) => {
    if (!isDragging || !containerRef.current) return;
    const containerWidth = containerRef.current.getBoundingClientRect().width;
    const newWidth =
      ((e.clientX - containerRef.current.getBoundingClientRect().left) /
        containerWidth) *
      100;
    if (newWidth > 20 && newWidth < 80) {
      setEditorWidth(newWidth);
      requestAnimationFrame(() => editorRef.current?.layout());
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

  const handleChange = (value) => setCode(value);
  const handleRefreshPreview = () => setRefreshKey((prev) => prev + 1);
  const handleDeviceChange = (mode) => setDeviceMode(mode); // 🆕 update mode

  // Generate iframe content
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

  // 🔧 Dynamic preview size
  const iframeStyle =
    deviceMode === "mobile"
      ? {
          width: "390px",
          height: "100%",
          border: "1px solid #ccc",
          borderRadius: "12px",
          margin: "0 auto",
          display: "block",
          boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        }
      : { width: "100%", height: "100%", border: "none" };

  return (
    <div className="w-full h-[99vh] flex flex-col">
      {/* 🧭 NavBar */}
      <NavBarComponent
        onRefresh={handleRefreshPreview}
        onDeviceChange={handleDeviceChange}
      />

      {/* 🧩 Editor + Preview */}
      <div
        ref={containerRef}
        className="flex flex-row flex-grow w-full"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Left: Code Editor */}
        <div
          className="relative flex flex-col border-r"
          style={{ width: `${editorWidth}%`, minHeight: 0 }}
        >
          <button
            id="btnCopy"
            onClick={handleCopy}
            className="bi bi-link-45deg btn btn-dark btn-sm m-1 ms-auto me-5"
            style={{ width: "40px" }}
            title={copied ? "Copied!" : "Copy code"}
          >
            {copied ? "✔" : ""}
          </button>

          <div className="flex-grow overflow-auto min-h-0">
            <Editor
              height="100%"
              width="99%"
              defaultLanguage="html"
              theme="vs-dark"
              value={code}
              onChange={handleChange}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: false },
                fontSize: 16,
                automaticLayout: true,
                wordWrap: "on",
              }}
            />
          </div>

          <div id="inputComponent">
            <InputComponent setCode={setCode} setThemeImages={setThemeImages} />
          </div>
        </div>

        {/* Divider */}
        <div
          className="cursor-col-resize h-full w-1 bg-gray-300 hover:bg-gray-400"
          onMouseDown={handleMouseDown}
        />

        {/* Right: Live Preview */}
<div
  className="flex-1 h-full min-h-0 flex justify-center items-center transition-all duration-300 relative"
  style={{
    backgroundColor: "#ffffffff", // always a clean neutral background
    backgroundImage:
      deviceMode !== "mobile" && themeImages.length
        ? `url(${themeImages[0]})`
        : "none",
    backgroundSize: "cover",
    backgroundPosition: "center",
    backgroundRepeat: "no-repeat",
  }}
>
  {/* ❌ Removed the blurred overlay — clean background now */}

  {deviceMode === "mobile" ? (
    <div
      className="relative transition-all duration-300"
      style={{
        marginTop: "0px",
        width: "317px",
        height: "610px", // iPhone 14 height
        borderRadius: "40px",
        border: "12px solid #222",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        background: "#000",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* 🔹 Notch */}
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

      {/* 🔹 iframe content */}
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
    // 💻 Desktop Mode
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