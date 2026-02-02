import React, { useState, useRef, useEffect } from "react";
import "./fileExplorerComponent.css";

export function FileExplorerComponent({ files, onFileSelect, onRefresh, onClose }) {
  const [expandedFolders, setExpandedFolders] = useState({});
  const fileExplorerRef = useRef(null);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (fileExplorerRef.current && !fileExplorerRef.current.contains(event.target)) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const toggleFolder = (folderPath) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderPath]: !prev[folderPath]
    }));
  };

  const renderFileTree = (fileStructure, path = "") => {
    return Object.entries(fileStructure).map(([name, content]) => {
      const currentPath = path ? `${path}/${name}` : name;
      const isFolder = typeof content === "object";
      
      if (isFolder) {
        const isExpanded = expandedFolders[currentPath];
        return (
          <div key={currentPath} className="file-tree-item">
            <div 
              className="folder-item" 
              onClick={() => toggleFolder(currentPath)}
            >
              <span className={`folder-icon ${isExpanded ? 'expanded' : ''}`}>
                {isExpanded ? '📂' : '📁'}
              </span>
              <span className="folder-name">{name}</span>
            </div>
            {isExpanded && (
              <div className="folder-children">
                {renderFileTree(content, currentPath)}
              </div>
            )}
          </div>
        );
      } else {
        return (
          <div 
            key={currentPath} 
            className="file-item"
            onClick={() => onFileSelect(currentPath, content)}
          >
            <span className="file-icon">📄</span>
            <span className="file-name">{name}</span>
          </div>
        );
      }
    });
  };

  // Convert flat files structure to nested structure
  const buildFileStructure = () => {
    const structure = {};
    
    files.forEach(file => {
      const pathParts = file.path.split('/');
      let currentLevel = structure;
      
      pathParts.forEach((part, index) => {
        if (index === pathParts.length - 1) {
          // It's a file
          currentLevel[part] = file.content;
        } else {
          // It's a folder
          if (!currentLevel[part]) {
            currentLevel[part] = {};
          }
          currentLevel = currentLevel[part];
        }
      });
    });
    
    return structure;
  };

  // Check if we have generated files or just the default
  const hasGeneratedFiles = files.length > 0 && !(files.length === 1 && files[0].isDefault);

  return (
    <div ref={fileExplorerRef} className="file-explorer">
      <div className="file-explorer-header">
        <h6 className="bg-dark">Project Files</h6>
        <div>
          {hasGeneratedFiles && (
            <button 
              className="btn btn-sm btn-outline-secondary refresh-btn me-2"
              onClick={onRefresh}
              title="Clear Files"
            >
              Clear
            </button>
          )}
          <button 
            className="btn btn-sm btn-close-white"
            onClick={onClose}
            title="Close"
            style={{ 
              background: 'transparent', 
              border: 'none', 
              color: '#fff', 
              fontSize: '18px', 
              padding: '2px 8px',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      </div>
      <div className="file-tree">
        {hasGeneratedFiles ? (
          renderFileTree(buildFileStructure())
        ) : (
          <div className="no-files">
            <div className="default-file-item" onClick={() => onFileSelect("index.html", files[0]?.content)}>
              <span className="file-icon bg-dark">📄</span>
              <span className="file-name bg-black rounded-pill">index.html</span>
              <span className="badge bg-warning text-dark mx-2">default</span>
            </div>
            <div className="no-files-message">Generate code to see more files</div>
          </div>
        )}
      </div>
    </div>
  );
}