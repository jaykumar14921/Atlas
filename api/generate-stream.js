import Anthropic from '@anthropic-ai/sdk';
import formidable from 'formidable';
import fs from 'fs';

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
      if (!validMimeTypes[mimeType]) {
        console.warn(`Skipping unsupported image format: ${file.mimetype}`);
        return false;
      }
      return true;
    })
    .map((file) => {
      const mimeType = file.mimetype?.toLowerCase();
      const validMimeType = validMimeTypes[mimeType];
      const buffer = fs.readFileSync(file.filepath);

      return {
        type: 'image',
        source: {
          type: 'base64',
          media_type: validMimeType,
          data: buffer.toString('base64'),
        },
      };
    });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS headers
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
    const imageFiles = files.images ? (Array.isArray(files.images) ? files.images : [files.images]) : [];

    console.log(`Generating code for prompt: "${prompt}" with ${imageFiles.length} image(s)`);

    const imageContent = await processImages(imageFiles);

    const content = [
      ...imageContent,
      {
        type: 'text',
        text: `Create a clean, functional web page: ${prompt}

Requirements:
- Single HTML file with embedded CSS and JavaScript
- Simple, modern design
- Fully functional and responsive
- Return ONLY the HTML code, starting with <!DOCTYPE html>

Keep it minimal.`,
      },
    ];

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('X-Accel-Buffering', 'no');

    const stream = await anthropic.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
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
    console.error('Generation error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate code' });
  }
}
