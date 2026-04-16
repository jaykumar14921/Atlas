import Anthropic from '@anthropic-ai/sdk';
import formidable from 'formidable';
import fs from 'fs';
import AdmZip from 'adm-zip';

export const config = {
  api: {
    bodyParser: false,
  },
};

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const validMimeTypes = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'image/gif': 'image/gif',
  'image/webp': 'image/webp',
};

async function processImages(files) {
  if (!files || files.length === 0) return [];
  const fileArray = Array.isArray(files) ? files : [files];

  return fileArray
    .filter((file) => {
      const mimeType = file.mimetype?.toLowerCase();
      return !!validMimeTypes[mimeType];
    })
    .map((file) => {
      const mimeType = file.mimetype?.toLowerCase();
      const buffer = fs.readFileSync(file.filepath);
      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: validMimeTypes[mimeType],
          data: buffer.toString('base64'),
        },
      };
    });
}

function extractZipContents(zipBuffer) {
  const zip = new AdmZip(zipBuffer);
  const zipEntries = zip.getEntries();

  let projectStructure = '';
  const files = [];

  zipEntries.forEach((entry) => {
    if (!entry.isDirectory && !entry.entryName.includes('__MACOSX') && !entry.entryName.startsWith('.')) {
      const content = entry.getData().toString('utf8');
      projectStructure += `\n\n=== ${entry.entryName} ===\n${content}`;
      files.push({
        path: entry.entryName,
        name: entry.entryName.split('/').pop(),
        size: entry.header.size,
      });
    }
  });

  return { projectStructure, files };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const form = formidable({ multiples: true });

    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const prompt = Array.isArray(fields.prompt) ? fields.prompt[0] : fields.prompt || '';
    const zipFiles = files.projectZip ? (Array.isArray(files.projectZip) ? files.projectZip : [files.projectZip]) : [];
    const imageFiles = files.images ? (Array.isArray(files.images) ? files.images : [files.images]) : [];

    if (zipFiles.length === 0) {
      return res.status(400).json({ error: 'No ZIP files provided' });
    }

    let combinedProjectStructure = '';
    let allFiles = [];

    zipFiles.forEach((zipFile, index) => {
      const buffer = fs.readFileSync(zipFile.filepath);
      const { projectStructure, files: extractedFiles } = extractZipContents(buffer);
      combinedProjectStructure += `\n\n=== PROJECT ${index + 1}: ${zipFile.originalFilename} ===\n${projectStructure}`;
      allFiles = [...allFiles, ...extractedFiles];
    });

    const imageContent = await processImages(imageFiles);

    const content = [
      ...imageContent,
      {
        type: 'text',
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
- Start directly with the first === header`,
      },
    ];

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`FILE_STRUCTURE:${JSON.stringify(allFiles)}\n\n`);

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 16000,
      messages: [{ role: 'user', content }],
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        res.write(chunk.delta.text);
      }
    }

    res.write('\n[DONE]');
    res.end();
  } catch (error) {
    console.error('Project processing error:', error);
    res.status(500).json({ error: error.message || 'Failed to process project' });
  }
}
