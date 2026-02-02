import React, { useRef, useState, useEffect } from "react";
import logo from "../../assets/imgLogo.jpg";
import "./inputComponent.css";

export function InputComponent({ setCode, setThemeImages }) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState([]); // [{ url, name }]
  const fileRef = useRef(null);
  const textareaRef = useRef(null);

  // =====================
  // 🔹 Handle image upload
  // =====================
  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    // ✅ Generate new image URLs
    const newImages = files.map((file) => ({
      url: URL.createObjectURL(file),
      name: file.name,
    }));

    // ✅ Merge with existing images
    setImages((prev) => {
      const updated = [...prev, ...newImages];
      setThemeImages(updated.map((img) => img.url));
      return updated;
    });

    // Reset file input to allow re-upload of same file
    e.target.value = "";
  };

  // ✅ Cleanup URLs ONLY when component unmounts (not every re-render)
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

  // =====================
  // 🔹 Handle code generation
  // =====================
  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setCode("");

    try {
      const response = await fetch("http://localhost:5000/generate-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) throw new Error("Failed to start generation stream");

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let generatedCode = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        generatedCode += chunk;
        setCode((prev) => prev + chunk);
      }

      setLoading(false);
    } catch (error) {
      console.error(error);
      setLoading(false);
    }
  };

  return (
  <div className="input-wrapper mx-2 px-1">
    

   <div className="p-1">
      <textarea
      ref={textareaRef}
      className="form-control mt-1"
      placeholder="Ask Horizon anything..."
      rows="2"
      value={prompt}
      onChange={(e) => setPrompt(e.target.value)}
    />

        {/* Hidden file input */}
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      multiple
      style={{ display: "none" }}
      onChange={handleImageUpload}
    />

    {/* Upload + Previews + Generate Button */}
    <div className="input-actions d-flex align-items-center justify-content-between mt-3 flex-wrap">
      {/* Left Side: Upload + Images */}
      <div className="d-flex align-items-center gap-3 flex-wrap">
        {/* Upload Button */}
        <button
          type="button"
          className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-2"
          onClick={openFilePicker}
        >
          <img
            src={logo}
            alt="upload-icon"
            style={{ width: 18, height: 18, borderRadius: 4 }}
          />
          Upload
        </button>

        {/* Image Previews */}
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {images.slice(0, 3).map((img, idx) => (
            <div key={idx} className="preview-box">
              <img src={img.url} alt={`preview-${idx}`} className="preview-img" />
              <button
                type="button"
                className="remove-btn"
                onClick={() => removeImageAt(idx)}
              >
                ×
              </button>
            </div>
          ))}
          {images.length > 3 && (
            <div className="preview-more" title={`${images.length - 3} more`}>
              +{images.length - 3}
            </div>
          )}
        </div>
      </div>

      {/* Right Side: Generate */}
      <button
        type="button"
        disabled={loading}
        className="btn btn-sm btn-primary generate-btn"
        onClick={handleGenerate}
      >
        {loading ? "Generating..." : "Generate Code"}
      </button>
    </div>
   </div>
  </div>
);

}
