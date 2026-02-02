import Anthropic from '@anthropic-ai/sdk';
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cacheManager from "./src/utils/cacheManager.js";
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
const app = express();

const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024,  // 50MB for zip files
    files: 10  // Max 10 files (images + zip)
  }
});

app.use(cors());
app.use(express.json());

// ✅ Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ✅ Cost tracking
let dailyCost = 0;
let dailyStats = {
  requests: 0,
  cacheHits: 0,
  cacheMisses: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCachedTokens: 0,
  zipProjectsProcessed: 0,
};

// Reset stats daily
setInterval(() => {
  console.log(`\n📊 DAILY STATS RESET`);
  console.log(`Previous stats:`, dailyStats);
  console.log(`Total cost: $${dailyCost.toFixed(4)}`);
  dailyCost = 0;
  dailyStats = {
    requests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
    zipProjectsProcessed: 0,
  };
}, 24 * 60 * 60 * 1000);

// ========================================
// CLAUDE SONNET 4.5 - COMPREHENSIVE SYSTEM PROMPT
// ========================================
const SYSTEM_PROMPT = `You are an elite frontend developer and UI/UX designer specializing in creating stunning, production-ready websites.

🎯 CORE MISSION:
Create complete, functional, and visually impressive websites that users can deploy immediately.

📐 TECHNICAL REQUIREMENTS:

1. HTML STRUCTURE:
   - Use semantic HTML5 elements (header, nav, main, section, article, footer)
   - Include proper DOCTYPE, meta tags, and viewport settings
   - Add Open Graph and Twitter Card meta tags for social sharing
   - Implement proper heading hierarchy (h1-h6)
   - Use descriptive alt text for all images
   - Include ARIA labels for accessibility

2. STYLING WITH TAILWIND CSS:
   - Use Tailwind CSS exclusively via CDN
   - Implement mobile-first responsive design
   - Use Tailwind's utility classes for all styling
   - Create smooth transitions and animations
   - Ensure consistent spacing and typography
   - Use color palettes that complement each other

3. JAVASCRIPT:
   - Write modern ES6+ JavaScript
   - Use const/let (never var)
   - Implement proper error handling
   - Add smooth scroll behavior
   - Include form validation where applicable
   - Create interactive UI elements
   - Use event delegation for performance

4. RESPONSIVE DESIGN:
   - Mobile (sm): 640px and below
   - Tablet (md): 768px and above
   - Desktop (lg): 1024px and above
   - Large screens (xl): 1280px and above
   - Extra large (2xl): 1536px and above

5. ACCESSIBILITY (WCAG 2.1 AA):
   - Color contrast ratio minimum 4.5:1 for text
   - All interactive elements keyboard accessible
   - Focus indicators visible and clear
   - Screen reader friendly markup
   - No content relies solely on color

🎨 DESIGN PRINCIPLES:

1. VISUAL HIERARCHY:
   - Clear distinction between headings and body text
   - Consistent spacing that guides the eye
   - Strategic use of white space
   - Emphasis on important elements
   - Logical flow from top to bottom

2. COLOR THEORY:
   - Use complementary color schemes
   - Maintain brand consistency
   - Create visual interest with accent colors
   - Ensure readability with proper contrast
   - Use gradients tastefully

3. TYPOGRAPHY:
   - Use Google Fonts or system fonts
   - Maintain readable line heights (1.5-1.8)
   - Keep line length optimal (50-75 characters)
   - Use font weights to create hierarchy
   - Ensure mobile text is at least 16px

4. LAYOUT PATTERNS:
   - Hero sections with clear CTAs
   - Card-based content organization
   - Grid layouts for galleries/products
   - Sticky navigation for easy access
   - Footer with relevant links and info

🎯 OUTPUT FORMAT:

Provide a complete, single-file HTML document that includes:
1. Complete DOCTYPE and HTML structure
2. All necessary meta tags and CDN links
3. Embedded CSS in <style> tag if needed
4. All HTML content with Tailwind classes
5. JavaScript in <script> tag at the end
6. Comments explaining key sections
7. Mobile menu toggle functionality
8. Form validation if forms are present
9. Smooth scroll behavior
10. Responsive images with proper sizing

CRITICAL: The output must be:
- ✅ Complete and ready to use
- ✅ Mobile responsive
- ✅ Accessible (WCAG AA)
- ✅ Visually appealing
- ✅ Functionally interactive
- ✅ Production-ready`;

// ========================================
// PROJECT UPGRADE SYSTEM PROMPT
// ========================================
const PROJECT_UPGRADE_PROMPT = `You are an expert web developer tasked with fixing, upgrading, or completing an existing web project.

🎯 YOUR MISSION:
Analyze the provided project files and user requirements to make the necessary changes while maintaining code quality and consistency.

📋 TASKS YOU CAN PERFORM:
1. **Bug Fixes**: Identify and fix errors, broken functionality, or UI issues
2. **Feature Upgrades**: Add new features or enhance existing ones
3. **Code Completion**: Complete incomplete implementations
4. **Optimization**: Improve performance, accessibility, or code quality
5. **Styling Upgrades**: Modify CSS/Tailwind classes, layouts, or designs
6. **Responsive Fixes**: Ensure proper mobile/tablet/desktop responsiveness

🔍 ANALYSIS APPROACH:
1. Review all provided files to understand the project structure
2. Identify the specific areas that need attention based on user request
3. Plan changes that maintain consistency with existing code style
4. Implement fixes/updates while preserving working functionality
5. Ensure all changes are production-ready

⚙️ BEST PRACTICES:
- Maintain existing naming conventions and code style
- Preserve working features while making updates
- Add comments for significant changes
- Ensure backward compatibility where possible
- Test edge cases in your implementations
- Keep the code clean and maintainable

📤 OUTPUT REQUIREMENTS:
- Return the complete, updated HTML file(s)
- Include all necessary CSS and JavaScript
- Maintain the original file structure if possible
- Clearly document what was changed
- Ensure the output is immediately usable

CRITICAL RULES:
✅ Only modify what's requested
✅ Don't break existing functionality
✅ Maintain code quality standards
✅ Ensure responsive design works
✅ Keep accessibility features intact
✅ Preserve any external dependencies (CDNs, APIs)`;

// ========================================
// EXTRACT AND ANALYZE ZIP PROJECT
// ========================================
async function extractAndAnalyzeProject(zipBuffer) {
  try {
    console.log('📦 Extracting ZIP file...');
    const zip = new AdmZip(zipBuffer);
    const zipEntries = zip.getEntries();
    
    const projectFiles = [];
    let projectStructure = '';
    
    for (const entry of zipEntries) {
      // Skip directories, hidden files, and common non-essential files
      if (entry.isDirectory || 
          entry.entryName.startsWith('__MACOSX') ||
          entry.entryName.startsWith('.') ||
          entry.entryName.includes('node_modules') ||
          entry.entryName.includes('.git')) {
        continue;
      }

      // Only process text-based web files
      const validExtensions = ['.html', '.css', '.js', '.jsx', '.json', '.txt', '.md'];
      const ext = path.extname(entry.entryName).toLowerCase();
      
      if (validExtensions.includes(ext)) {
        const content = entry.getData().toString('utf8');
        projectFiles.push({
          path: entry.entryName,
          content: content,
          size: entry.header.size
        });
        
        projectStructure += `\n📁 ${entry.entryName} (${(entry.header.size / 1024).toFixed(2)} KB)\n`;
      }
    }

    console.log(`✅ Extracted ${projectFiles.length} files`);
    console.log(projectStructure);

    return { projectFiles, projectStructure };
  } catch (error) {
    console.error('❌ ZIP extraction error:', error);
    throw new Error('Failed to extract ZIP file. Please ensure it\'s a valid ZIP archive.');
  }
}

// ========================================
// ANALYZE IMAGES WITH CLAUDE SONNET 4.5
// ========================================
async function analyzeImagesWithClaude(images, prompt) {
  if (images.length === 0) {
    return "No images provided for analysis.";
  }

  try {
    console.log(`🔍 Analyzing ${images.length} image(s) with Claude Sonnet 4.5...`);

    const content = [
      {
        type: "text",
        text: `Analyze these reference images for a web design project.

USER REQUEST: "${prompt}"

Provide detailed design analysis focusing on:
🎨 COLOR PALETTE:
- Primary colors (with hex codes)
- Secondary colors
- Accent colors
- Background colors
- Text colors

📐 LAYOUT & SPACING:
- Grid system used
- Spacing patterns
- Alignment strategies
- Component positioning
- White space usage

🖋️ TYPOGRAPHY:
- Font families (or similar alternatives)
- Font sizes and hierarchy
- Font weights used
- Line heights
- Letter spacing

🧩 COMPONENTS & ELEMENTS:
- Button styles
- Card designs
- Navigation patterns
- Form elements
- Icons and graphics

🎯 OVERALL AESTHETIC:
- Design style (modern, minimalist, bold, playful, etc.)
- Visual mood and tone
- Target audience feel
- Brand personality
- Unique design elements

Provide SPECIFIC, ACTIONABLE insights that can be directly translated into Tailwind CSS classes.`
      }
    ];

    for (const image of images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: image.mimetype,
          data: image.buffer.toString('base64')
        }
      });
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: content
        }
      ]
    });

    const analysis = response.content[0].text;
    
    console.log(`📊 Image Analysis Tokens:`, {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens
    });

    return analysis;

  } catch (error) {
    console.error("❌ Claude image analysis error:", error.message);
    return `Analyzed ${images.length} reference image(s). Creating a modern, responsive web design.`;
  }
}

// ========================================
// GENERATE CODE WITH CLAUDE SONNET 4.5 + PROMPT CACHING
// ========================================
async function generateCodeWithClaude(prompt, imageAnalysis, res, cacheKey, projectContext = null) {
  try {
    let fullResponse = "";
    let fileStructure = [];

    // ✅ Determine if this is a project upgrade or new generation
    const isProjectUpgrade = projectContext !== null;

    // ✅ Build the enhanced prompt
    let enhancedPrompt = '';
    
    if (isProjectUpgrade) {
      // Project upgrade mode
      enhancedPrompt = `🔧 PROJECT UPGRADE REQUEST:

USER REQUEST: "${prompt}"

📦 CURRENT PROJECT STRUCTURE:
${projectContext.projectStructure}

📄 PROJECT FILES:
${projectContext.projectFiles.map((file, idx) => `
--- FILE ${idx + 1}: ${file.path} ---
${file.content}
---END OF FILE---
`).join('\n\n')}

${imageAnalysis !== "No images provided for analysis." ? `
📸 REFERENCE IMAGE ANALYSIS:
${imageAnalysis}
` : ''}

🎯 INSTRUCTIONS:
- Analyze the current project files carefully
- Make the specific changes requested by the user
- Maintain the existing code style and structure
- Fix any bugs or issues mentioned
- Add or upgrade features as requested
- Ensure all changes are production-ready
- Return the complete, upgraded HTML file(s)
- Preserve all working functionality`;

    } else {
      // New generation mode
      enhancedPrompt = imageAnalysis.includes("No images provided") 
        ? prompt
        : `🎨 DESIGN-FOCUSED DEVELOPMENT REQUEST:

USER PROMPT: "${prompt}"

📸 REFERENCE IMAGE ANALYSIS:
${imageAnalysis}

🎯 IMPLEMENTATION INSTRUCTIONS:
- Translate the analyzed design elements into clean, modern HTML/CSS
- Use Tailwind CSS classes that match the exact color schemes identified
- Implement the layout patterns and spacing from the analysis
- Match typography styles and hierarchy
- Recreate component designs and interactions
- Capture the overall aesthetic and visual mood
- Ensure the design works responsively across all devices
- Create a cohesive, production-ready website`;
    }

    console.log(`🚀 Generating code with Claude Sonnet 4.5 (${isProjectUpgrade ? 'PROJECT UPGRADE' : 'NEW GENERATION'})...`);

    // ✅ Create Claude API request with PROMPT CACHING
    const systemPrompt = isProjectUpgrade ? PROJECT_UPGRADE_PROMPT : SYSTEM_PROMPT;
    
    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 15000,
      
      system: [
        {
          type: 'text',
          text: systemPrompt,
          cache_control: { type: "ephemeral" }
        }
      ],
      
      messages: [
        {
          role: 'user',
          content: enhancedPrompt
        }
      ],
    });

    // ✅ Stream response to client
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        const token = event.delta.text;
        if (token) {
          fullResponse += token;
          res.write(`data: ${token}\n\n`);
        }
      }
      
      if (event.type === 'message_start') {
        const usage = event.message.usage;
        const cacheCreation = usage.cache_creation_input_tokens || 0;
        const cacheRead = usage.cache_read_input_tokens || 0;
        const inputTokens = usage.input_tokens || 0;
        
        console.log(`📊 Token Usage:`, {
          input: inputTokens,
          cacheCreation: cacheCreation,
          cacheRead: cacheRead,
          output: '(streaming...)'
        });
        
        const inputCost = (inputTokens / 1000000) * 3.00;
        const cacheCost = (cacheCreation / 1000000) * 3.75;
        const cacheReadCost = (cacheRead / 1000000) * 0.30;
        const totalInputCost = inputCost + cacheCost + cacheReadCost;
        
        console.log(`💰 Input Cost: $${totalInputCost.toFixed(6)}`);
        
        if (cacheRead > 0) {
          const savedCost = (cacheRead / 1000000) * (3.00 - 0.30);
          console.log(`💎 Cache Savings: $${savedCost.toFixed(6)} (90% off ${cacheRead} tokens)`);
          dailyStats.cacheHits++;
        } else {
          dailyStats.cacheMisses++;
        }
        
        dailyStats.totalInputTokens += inputTokens;
        dailyStats.totalCachedTokens += cacheRead;
      }
    }

    const finalMessage = await stream.finalMessage();
    const outputTokens = finalMessage.usage.output_tokens;
    const outputCost = (outputTokens / 1000000) * 15.00;
    
    console.log(`📊 Output Tokens: ${outputTokens}`);
    console.log(`💰 Output Cost: $${outputCost.toFixed(6)}`);
    
    dailyStats.totalOutputTokens += outputTokens;
    dailyStats.requests++;
    
    if (isProjectUpgrade) {
      dailyStats.zipProjectsProcessed++;
    }

    const usage = finalMessage.usage;
    const totalCost = 
      ((usage.input_tokens || 0) / 1000000) * 3.00 +
      ((usage.cache_creation_input_tokens || 0) / 1000000) * 3.75 +
      ((usage.cache_read_input_tokens || 0) / 1000000) * 0.30 +
      (outputTokens / 1000000) * 15.00;
    
    dailyCost += totalCost;
    console.log(`💵 Total Request Cost: $${totalCost.toFixed(6)}`);
    console.log(`📊 Daily Total: $${dailyCost.toFixed(4)}`);

    fileStructure = parseCodeIntoFiles(fullResponse);

    if (cacheKey && !isProjectUpgrade) {
      cacheManager.setCacheEntry(cacheKey, fullResponse, fileStructure, prompt);
      console.log('💾 Stored in application cache');
    }

    res.write(`data: FILE_STRUCTURE:${JSON.stringify(fileStructure)}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();

  } catch (error) {
    console.error("❌ Claude generation error:", error);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Code generation failed",
        details: error.message 
      });
    }
  }
}

// ========================================
// PARSE CODE INTO FILES
// ========================================
function parseCodeIntoFiles(generatedCode) {
  const files = [];
  
  const htmlMatches = generatedCode.match(/<!DOCTYPE html>[\s\S]*?<\/html>/gi) || [];
  htmlMatches.forEach((html, index) => {
    files.push({
      path: index === 0 ? 'index.html' : `page${index + 1}.html`,
      content: html.trim(),
      language: 'html'
    });
  });
  
  if (files.length === 0) {
    const partialHtml = generatedCode.match(/<html[\s\S]*?<\/html>/gi);
    if (partialHtml && partialHtml.length > 0) {
      files.push({
        path: 'index.html',
        content: partialHtml[0].trim(),
        language: 'html'
      });
    }
  }
  
  const styleMatches = generatedCode.match(/<style[\s\S]*?<\/style>/gi) || [];
  styleMatches.forEach((css, index) => {
    const cssContent = css.replace(/<style[^>]*>/i, '').replace(/<\/style>/i, '').trim();
    if (cssContent && !files.some(f => f.content.includes(css))) {
      files.push({
        path: index === 0 ? 'styles.css' : `styles${index + 1}.css`,
        content: cssContent,
        language: 'css'
      });
    }
  });
  
  const scriptMatches = generatedCode.match(/<script[\s\S]*?<\/script>/gi) || [];
  scriptMatches.forEach((js, index) => {
    const jsContent = js.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    if (jsContent && !files.some(f => f.content.includes(js))) {
      files.push({
        path: index === 0 ? 'script.js' : `script${index + 1}.js`,
        content: jsContent,
        language: 'javascript'
      });
    }
  });
  
  if (files.length === 0) {
    files.push({
      path: 'index.html',
      content: generatedCode.trim(),
      language: 'html'
    });
  }
  
  return files;
}

// ========================================
// MAIN GENERATION ENDPOINT (NEW PROJECTS)
// ========================================
app.post("/generate-stream", upload.array('images', 5), async (req, res) => {
  const { prompt } = req.body;
  const images = req.files || [];

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 NEW PROJECT REQUEST`);
  console.log(`📝 Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}"`);
  console.log(`📸 Images: ${images.length}`);
  console.log(`${'='.repeat(60)}`);

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const imageAnalysis = images.length > 0
      ? await analyzeImagesWithClaude(images, prompt)
      : "No images provided for analysis.";

    const cacheKey = cacheManager.generateCacheKey(prompt, imageAnalysis);
    
    const cachedEntry = cacheManager.getCacheEntry(cacheKey);
    if (cachedEntry) {
      console.log('✅ APPLICATION CACHE HIT! Returning cached code instantly.');
      
      res.write(`data: ${cachedEntry.code}\n\n`);
      res.write(`data: FILE_STRUCTURE:${JSON.stringify(cachedEntry.files)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      
      dailyStats.requests++;
      dailyStats.cacheHits++;
      return;
    }

    console.log('📝 Application cache miss. Generating with Claude Sonnet 4.5...');

    await generateCodeWithClaude(prompt, imageAnalysis, res, cacheKey);

  } catch (err) {
    console.error("❌ Processing error:", err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Processing failed",
        details: err.message 
      });
    }
  }
});

// ========================================
// PROJECT UPGRADE ENDPOINT (ZIP UPLOADS)
// ========================================
app.post("/generate-from-project", upload.fields([
  { name: 'images', maxCount: 5 },
  { name: 'projectZip', maxCount: 1 }
]), async (req, res) => {
  const { prompt } = req.body;
  const images = req.files?.images || [];
  const projectZip = req.files?.projectZip?.[0];

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  if (!projectZip) {
    return res.status(400).json({ error: "Missing project ZIP file" });
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔧 PROJECT UPGRADE REQUEST`);
  console.log(`📝 Prompt: "${prompt.substring(0, 80)}${prompt.length > 80 ? '...' : ''}"`);
  console.log(`📸 Images: ${images.length}`);
  console.log(`📦 ZIP: ${projectZip.originalname} (${(projectZip.size / 1024).toFixed(2)} KB)`);
  console.log(`${'='.repeat(60)}`);

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    // Step 1: Extract and analyze project
    const { projectFiles, projectStructure } = await extractAndAnalyzeProject(projectZip.buffer);

    if (projectFiles.length === 0) {
      throw new Error('No valid web files found in ZIP. Please include HTML, CSS, or JS files.');
    }

    // Step 2: Analyze images if provided
    const imageAnalysis = images.length > 0
      ? await analyzeImagesWithClaude(images, prompt)
      : "No images provided for analysis.";

    // Step 3: Generate updated code
    const projectContext = {
      projectFiles,
      projectStructure
    };

    await generateCodeWithClaude(prompt, imageAnalysis, res, null, projectContext);

  } catch (err) {
    console.error("❌ Project processing error:", err);
    if (!res.headersSent) {
      res.status(500).json({ 
        error: "Project processing failed",
        details: err.message 
      });
    }
  }
});

// ========================================
// CACHE MANAGEMENT ENDPOINTS
// ========================================

app.post("/cache/check", (req, res) => {
  const { prompt, imageAnalysis } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const cacheKey = cacheManager.generateCacheKey(prompt, imageAnalysis || "");
  const isCached = cacheManager.isCached(cacheKey);

  if (isCached) {
    const cachedEntry = cacheManager.getCacheEntry(cacheKey);
    return res.json({
      cached: true,
      message: "Code found in cache",
      cacheKey,
      files: cachedEntry.files,
      code: cachedEntry.code,
      timestamp: cachedEntry.timestamp,
    });
  }

  res.json({
    cached: false,
    message: "No cached code found",
    cacheKey,
  });
});

app.post("/cache/store", (req, res) => {
  const { prompt, code, files, imageAnalysis } = req.body;

  if (!prompt || !code) {
    return res.status(400).json({ error: "Missing prompt or code" });
  }

  const cacheKey = cacheManager.generateCacheKey(prompt, imageAnalysis || "");
  const entry = cacheManager.setCacheEntry(cacheKey, code, files || [], prompt);

  res.json({
    success: true,
    message: "Code cached successfully",
    cacheKey,
    entry,
  });
});

app.post("/cache/compare", (req, res) => {
  const { oldCode, newCode, oldFiles, newFiles } = req.body;

  if (!oldCode || !newCode) {
    return res.status(400).json({ error: "Missing oldCode or newCode" });
  }

  const codeDiff = cacheManager.generateDiff(oldCode, newCode);

  let fileComparison = null;
  if (oldFiles && newFiles) {
    fileComparison = cacheManager.compareFiles(oldFiles, newFiles);
  }

  res.json({
    codeDiff,
    fileComparison,
    updateInstructions: cacheManager.getUpdateInstructions(
      oldFiles || [],
      newFiles || []
    ),
  });
});

app.get("/cache/stats", (req, res) => {
  const cacheStats = cacheManager.getCacheStats();
  res.json({
    ...cacheStats,
    dailyCost: `$${dailyCost.toFixed(4)}`,
    estimatedMonthlyCost: `$${(dailyCost * 30).toFixed(2)}`,
    dailyStats: dailyStats,
  });
});

app.post("/cache/clear", (req, res) => {
  const { olderThanMs } = req.body;

  cacheManager.clearCache(olderThanMs || null);

  res.json({
    success: true,
    message: olderThanMs 
      ? `Cache entries older than ${olderThanMs}ms cleared`
      : "All cache cleared",
    stats: cacheManager.getCacheStats(),
  });
});

app.post("/cache/history/add", (req, res) => {
  const { sessionId, code, files, prompt } = req.body;

  if (!sessionId || !code) {
    return res.status(400).json({ error: "Missing sessionId or code" });
  }

  cacheManager.addToHistory(sessionId, code, files || [], prompt || "");

  res.json({
    success: true,
    message: "Version added to history",
  });
});

app.post("/cache/history/undo", (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  const previousVersion = cacheManager.undo(sessionId);

  if (!previousVersion) {
    return res.json({
      success: false,
      message: "No previous version available",
    });
  }

  res.json({
    success: true,
    message: "Reverted to previous version",
    version: previousVersion,
  });
});

app.post("/cache/history/redo", (req, res) => {
  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: "Missing sessionId" });
  }

  const nextVersion = cacheManager.redo(sessionId);

  if (!nextVersion) {
    return res.json({
      success: false,
      message: "No next version available",
    });
  }

  res.json({
    success: true,
    message: "Moved to next version",
    version: nextVersion,
  });
});

// ========================================
// HEALTH CHECK
// ========================================
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    model: "Claude Sonnet 4.5",
    timestamp: new Date().toISOString(),
    dailyCost: `$${dailyCost.toFixed(4)}`,
    cacheSize: cacheManager.getCacheStats().totalEntries,
    stats: dailyStats,
  });
});

// ========================================
// START SERVER
// ========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`✅ SERVER STARTED`);
  console.log(`${'='.repeat(60)}`);
  console.log(`🤖 Model: Claude Sonnet 4.5`);
  console.log(`🚀 Port: ${PORT}`);
  console.log(`💾 Cache: Active (Application + API Prompt Caching)`);
  console.log(`💰 Cost Tracking: Enabled`);
  console.log(`📦 ZIP Processing: Enabled`);
  console.log(`🌐 Health: http://localhost:${PORT}/health`);
  console.log(`📊 Stats: http://localhost:${PORT}/cache/stats`);
  console.log(`${'='.repeat(60)}\n`);
});
