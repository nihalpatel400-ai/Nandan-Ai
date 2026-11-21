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

    const recentHistory = Array.isArray(history) ? history.slice(-6) : [];
    const contents = [
      ...recentHistory,
      {
        role: "user",
        parts,
      },
    ];

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      signal: AbortSignal.timeout(35000),
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: `You are NANDAN AI. Reply briefly and clearly in Hindi, Gujarati, or English as suitable (preferred: ${language}).`,
            },
          ],
        },
        contents,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || `Gemini API error (${response.status})`,
      });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") || "Koi jawab nahi mila.";

    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
