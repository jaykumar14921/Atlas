import React, { useState } from "react";
import { ChevronDown, ChevronRight, FileCode2, Folder, FolderOpen } from "lucide-react"; // You need 'lucide-react' package

// Helper component for a single file or folder
function TreeNode({ node, onFileSelect, activeFile }) {
  const [isOpen, setIsOpen] = useState(true);

  if (node.type === "folder") {
    return (
      <div className="file-node">
        <div className="folder-header" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <ChevronDown size={16} className="icon" /> : <ChevronRight size={16} className="icon" />}
          {isOpen ? <FolderOpen size={16} className="icon" /> : <Folder size={16} className="icon" />}
          <span className="node-name">{node.name}</span>
        </div>
        {isOpen && (
          <div className="folder-content">
            {node.children && node.children.map((child, index) => (
              <TreeNode
                key={child.path || index}
                node={child}
                onFileSelect={onFileSelect}
                activeFile={activeFile}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // It's a file
  const isActive = activeFile && activeFile.path === node.path;
  return (
    <div
      className={`file-node file-item ${isActive ? "active" : ""}`}
      onClick={() => onFileSelect(node)}
    >
      <FileCode2 size={16} className="icon" />
      <span className="node-name">{node.name}</span>
    </div>
  );
}

// Main Explorer component
export function FileExplorer({ fileTree, onFileSelect, activeFile }) {
  if (!fileTree) {
    return (
      <div className="file-explorer-empty">
        <p>No project generated</p>
      </div>
    );
  }

  return (
    <div className="file-explorer">
      <TreeNode
        node={fileTree}
        onFileSelect={onFileSelect}
        activeFile={activeFile}
      />
    </div>
  );
}