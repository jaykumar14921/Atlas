import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

// ============================
// 🔹 POST /generate-stream
// ============================
app.post("/generate-stream", async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    // Set SSE headers FIRST (so the connection is kept alive)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.(); // optional: ensure headers are sent immediately

    const response = await axios({
      method: "post",
      url: "https://openrouter.ai/api/v1/chat/completions",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      data: {
        model: "meta-llama/llama-3-70b-instruct",
        stream: true,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful AI coding assistant. Output clean, runnable code without explanations.",
          },
          { role: "user", content: prompt },
        ],
      },
      responseType: "stream",
    });

    // 🔹 Pipe streamed data to frontend
    response.data.on("data", (chunk) => {
      const lines = chunk.toString().split("\n").filter((line) => line.trim() !== "");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.replace(/^data: /, "");
          if (data === "[DONE]") {
            res.write("data: [DONE]\n\n");
            res.end();
            return;
          }
          try {
            const parsed = JSON.parse(data);
            const token = parsed.choices?.[0]?.delta?.content;
            if (token) res.write(`data: ${token}\n\n`);
          } catch {
            // ignore malformed JSON
          }
        }
      }
    });

    response.data.on("end", () => {
      res.write("data: [DONE]\n\n");
      res.end();
    });

    response.data.on("error", (err) => {
      console.error("Stream error:", err.message);
      res.write(`event: error\ndata: ${err.message}\n\n`);
      res.end();
    });
  } catch (err) {
    console.error("❌ Backend error:", err.response?.data || err.message);
    if (!res.headersSent)
      res.status(500).json({ error: "Llama stream request failed" });
  }
});

app.listen(5000, () => console.log("✅ Streaming server on port 5000"));
