const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Only POST requests allowed in NANDAN AI." });
  }

  try {
    const { message, history = [], imageBase64, mimeType, language = "Auto" } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "NANDAN AI API key is not configured." });
    }

    if (!message && !imageBase64) {
      return res.status(400).json({ error: "Please send a message or image to NANDAN AI." });
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

    const maxAttempts = 3;
    let lastStatus = 503;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          system_instruction: {
            parts: [
              {
                text: `You are NANDAN AI. Never mention Gemini or any underlying model. Reply quickly, clearly, and naturally in Hindi, Gujarati, or English (preferred: ${language}).`,
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

      if (response.ok) {
        const reply =
          data?.candidates?.[0]?.content?.parts
            ?.map((p) => p.text)
            .filter(Boolean)
            .join("\n") || "NANDAN AI could not generate a reply.";

        return res.status(200).json({ reply });
      }

      lastStatus = response.status;

      if ((response.status === 503 || response.status === 429) && attempt < maxAttempts) {
        await sleep(500);
        continue;
      }

      if (response.status === 503 || response.status === 429) {
        return res.status(503).json({
          error: "NANDAN AI is experiencing high traffic right now. Please try again in a moment.",
        });
      }

      return res.status(response.status).json({
        error: "NANDAN AI could not complete your request. Please try again.",
      });
    }

    return res.status(lastStatus).json({
      error: "NANDAN AI is experiencing high traffic right now. Please try again in a moment.",
    });
  } catch (err) {
    if (err?.name === "TimeoutError" || err?.name === "AbortError") {
      return res.status(504).json({
        error: "NANDAN AI took too long to respond. Please try again.",
      });
    }
    return res.status(500).json({
      error: "Something went wrong in NANDAN AI. Please try again.",
    });
  }
}
