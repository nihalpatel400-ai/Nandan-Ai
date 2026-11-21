export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests allowed" });
  }

  try {
    const { message, history = [], imageBase64, mimeType, language = "Auto" } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "GEMINI_API_KEY not found in Vercel" });
    }

    if (!message && !imageBase64) {
      return res.status(400).json({ error: "Message or image is required" });
    }

    const parts = [];
    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          data: imageBase64,
          mimeType,
        },
      });
    }
    if (message) {
      parts.push({ text: message });
    }

    const recentHistory = Array.isArray(history) ? history.slice(-8) : [];
    const contents = [
      ...recentHistory,
      {
        role: "user",
        parts,
      },
    ];

    const models = ["gemini-2.5-flash", "gemini-2.5-flash-lite"];
    let lastError = "Gemini API error";

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: `You are NANDAN AI. Reply clearly in Hindi, Gujarati, or English as suitable (preferred: ${language}).`,
              },
            ],
          },
          contents,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const reply =
          data?.candidates?.[0]?.content?.parts
            ?.map((p) => p.text)
            .filter(Boolean)
            .join("\n") || "Koi jawab nahi mila.";

        return res.status(200).json({ reply });
      }

      lastError = data?.error?.message || `HTTP ${response.status}`;

      // Agar overload / high demand (503/429) nahi hai toh aage retry mat karo
      if (response.status !== 503 && response.status !== 429) {
        return res.status(response.status).json({ error: lastError });
      }
    }

    return res.status(503).json({ error: lastError });
  } catch (err) {
    return res.status(500).json({ error: err.message || "Server error" });
  }
}
