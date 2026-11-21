export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests allowed" });
  }

  try {
    const { message, history = [], imageBase64, mimeType, language = "Auto" } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "API key is not configured for NANDAN AI." });
    }

    if (!message && !imageBase64) {
      return res.status(400).json({ error: "Please enter a message or image." });
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

    const recentHistory = Array.isArray(history) ? history.slice(-2) : [];
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
      signal: AbortSignal.timeout(18000),
      body: JSON.stringify({
        system_instruction: {
          parts: [
            {
              text: `You are NANDAN AI. Reply quickly, naturally, and concisely in Hindi, Gujarati, or English (preferred: ${language}).`,
            },
          ],
        },
        generationConfig: {
          maxOutputTokens: 350,
          temperature: 0.7,
        },
        contents,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const cleanMsg = (data?.error?.message || `Request failed (${response.status})`).replace(
        /gemini/gi,
        "NANDAN AI"
      );
      return res.status(response.status).json({ error: cleanMsg });
    }

    const reply =
      data?.candidates?.[0]?.content?.parts
        ?.map((p) => p.text)
        .filter(Boolean)
        .join("\n") || "NANDAN AI could not generate a reply.";

    return res.status(200).json({ reply });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      return res.status(504).json({
        error: "NANDAN AI took too long to respond. Please try again.",
      });
    }
    const cleanErr = (err?.message || "Something went wrong in NANDAN AI.").replace(
      /gemini/gi,
      "NANDAN AI"
    );
    return res.status(500).json({ error: cleanErr });
  }
}
