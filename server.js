// server.js
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import AdmZip from 'adm-zip';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Cache storage (in-memory for now)
const cache = new Map();

// =====================
// Cache Endpoints
// =====================
app.post('/cache/check', (req, res) => {
  const { prompt = '', imageAnalysis = '' } = req.body || {};
  const key = `${prompt}:${imageAnalysis}`;
  const entry = cache.get(key);
  
  if (entry) {
    return res.json({ 
      cached: true, 
      timestamp: entry.timestamp, 
      code: entry.code, 
      files: entry.files 
    });
  }
  return res.json({ cached: false });
});

app.post('/cache/store', (req, res) => {
  const { prompt = '', code = '', files = [], imageAnalysis = '' } = req.body || {};
  const key = `${prompt}:${imageAnalysis}`;
  
  cache.set(key, {
    code,
    files,
    timestamp: Date.now(),
    prompt
  });
  
  return res.json({ success: true });
});

// =====================
// Helper: Convert images to base64
// =====================
async function processImages(files) {
  if (!files || files.length === 0) return [];
  
  // Map of accepted MIME types
  const validMimeTypes = {
    'image/jpeg': 'image/jpeg',
    'image/jpg': 'image/jpeg',  // Normalize jpg to jpeg
    'image/png': 'image/png',
    'image/gif': 'image/gif',
    'image/webp': 'image/webp'
  };
  
  return files
    .filter(file => {
      const mimeType = file.mimetype.toLowerCase();
      if (!validMimeTypes[mimeType]) {
        console.warn(`⚠️  Skipping unsupported image format: ${file.mimetype} (${file.originalname})`);
        return false;
      }
      return true;
    })
    .map(file => {
      const mimeType = file.mimetype.toLowerCase();
      const validMimeType = validMimeTypes[mimeType];
      
      console.log(`✅ Processing image: ${file.originalname} (${validMimeType})`);
      
      return {
        type: "image",
        source: {
          type: "base64",
          media_type: validMimeType,
          data: file.buffer.toString('base64')
        }
      };
    });
}

// =====================
// Helper: Extract ZIP contents
// =====================
function extractZipContents(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();
  
  let projectStructure = '';
  const files = [];
  
  zipEntries.forEach(entry => {
    if (!entry.isDirectory && !entry.entryName.includes('__MACOSX') && !entry.entryName.startsWith('.')) {
      const content = entry.getData().toString('utf8');
      projectStructure += `\n\n=== ${entry.entryName} ===\n${content}`;
      
      files.push({
        path: entry.entryName,
        name: entry.entryName.split('/').pop(),
        size: entry.header.size
      });
    }
  });
  
  return { projectStructure, files };
}

// =====================
// Generate Code (with images, no ZIP)
// =====================
app.post('/generate-stream', upload.array('images'), async (req, res) => {
  try {
    const prompt = req.body.prompt || '';
    const imageFiles = req.files || [];
    
    console.log(`📝 Generating code for prompt: "${prompt}" with ${imageFiles.length} image(s)`);
    
    // Process images
    const imageContent = await processImages(imageFiles);
    
    // Build message content with improved prompt
    const content = [
  ...imageContent,
  {
    type: "text",
    text: `Create a clean, functional web page: ${prompt}

Requirements:
- Single HTML file with embedded CSS and JavaScript
- Simple, modern design
- Fully functional and responsive
- Return ONLY the HTML code, starting with <!DOCTYPE html>

Keep it minimal.`
  }
];
    
    
    // Set up streaming response
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Call Anthropic API with streaming and increased token limit
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000, // Increased from 4096 for better output
      messages: [{
        role: 'user',
        content: content
      }]
    });
    
    let fullCode = '';
    
    // Stream the response
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && 
          chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        fullCode += text;
        res.write(text);
      }
    }
    
    res.write('\n[DONE]');
    res.end();
    
    console.log('✅ Code generation complete');
    
  } catch (error) {
    console.error('❌ Generation error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to generate code' 
    });
  }
});

// =====================
// Generate from Project ZIP
// =====================
app.post('/generate-from-project', 
  upload.fields([{ name: 'projectZip', maxCount: 4 }, { name: 'images', maxCount: 10 }]), 
  async (req, res) => {
    try {
      const prompt = req.body.prompt || '';
      const zipFiles = req.files?.projectZip || [];
      const imageFiles = req.files?.images || [];
      
      console.log(`📦 Processing ${zipFiles.length} ZIP file(s) with prompt: "${prompt}"`);
      
      if (zipFiles.length === 0) {
        return res.status(400).json({ error: 'No ZIP files provided' });
      }
      
      // Extract all ZIP files
      let combinedProjectStructure = '';
      let allFiles = [];
      
      zipFiles.forEach((zipFile, index) => {
        const { projectStructure, files } = extractZipContents(zipFile.buffer);
        combinedProjectStructure += `\n\n=== PROJECT ${index + 1}: ${zipFile.originalname} ===\n${projectStructure}`;
        allFiles = [...allFiles, ...files];
      });
      
      // Process images
      const imageContent = await processImages(imageFiles);
      
      // Build message content with improved prompt
      const content = [
        ...imageContent,
        {
          type: "text",
          text: `You are a senior full-stack developer. I'm providing you with existing project code and need your expert help.

PROJECT CODE:
${combinedProjectStructure}

USER REQUEST:
${prompt}

CRITICAL INSTRUCTIONS:
1. Carefully analyze the existing code structure and architecture
2. Understand the current implementation patterns and conventions
3. Implement the requested changes/features professionally
4. Return the COMPLETE, UPDATED code for ALL modified files
5. Maintain consistency with existing code style and structure
6. Add clear comments explaining your changes
7. Ensure backward compatibility unless specifically asked to break it
8. Fix any bugs you notice while implementing the changes
9. Follow best practices and modern standards

OUTPUT FORMAT:
For each file you modify or create, use this EXACT format:

=== path/to/file.ext ===
[complete file content here]

IMPORTANT:
- Include the full file path in the header
- Provide the COMPLETE file content, not just changes
- Separate each file with the === header
- Include ALL files that need to be modified or created
- Do NOT include explanations outside of code comments
- Start directly with the first === header`
        }
      ];
      
      // Set up streaming response
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Send file structure first
      res.write(`FILE_STRUCTURE:${JSON.stringify(allFiles)}\n\n`);
      
      // Call Anthropic API with streaming and increased token limit
      const stream = await anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 16000, // Increased from 8192 for better output
        messages: [{
          role: 'user',
          content: content
        }]
      });
      
      let fullCode = '';
      
      // Stream the response
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && 
            chunk.delta.type === 'text_delta') {
          const text = chunk.delta.text;
          fullCode += text;
          res.write(text);
        }
      }
      
      res.write('\n[DONE]');
      res.end();
      
      console.log('✅ Project upgrade complete');
      
    } catch (error) {
      console.error('❌ Project processing error:', error);
      res.status(500).json({ 
        error: error.message || 'Failed to process project' 
      });
    }
  }
);

// =====================
// Health Check
// =====================
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    hasApiKey: !!process.env.ANTHROPIC_API_KEY 
  });
});

// =====================
// Start Server
// =====================
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  
  if (process.env.ANTHROPIC_API_KEY) {
    console.log('✅ Anthropic API key configured');
  } else {
    console.log('⚠️  WARNING: ANTHROPIC_API_KEY not set in .env file');
  }
});
