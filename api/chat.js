const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MODELS = ["gemini-3.8-flash", "gemini-2.5-flash"];

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

    const recentHistory = Array.isArray(history) ? history.slice(-1) : [];
    const contents = [
      ...recentHistory,
      {
        role: "user",
        parts,
      },
    ];

    const payload = JSON.stringify({
      system_instruction: {
        parts: [
          {
            text: "You are NANDAN AI. Never mention Gemini or any underlying model. Reply quickly, clearly, and naturally in Hindi, Gujarati, or English (preferred: " + language + ").",
          },
        ],
      },
      generationConfig: {
        maxOutputTokens: 250,
        temperature: 0.6,
      },
      contents,
    });

    let lastStatus = 503;

    for (const model of MODELS) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": apiKey,
            },
            signal: AbortSignal.timeout(7000),
            body: payload,
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

          if ((response.status === 503 || response.status === 429) && attempt < 2) {
            await sleep(400);
            continue;
          }

          if (response.status === 503 || response.status === 429 || response.status === 404) {
            break;
          }

          return res.status(response.status).json({
            error: "NANDAN AI could not complete your request. Please try again.",
          });
        } catch (innerErr) {
          if (innerErr?.name === "TimeoutError" || innerErr?.name === "AbortError") {
            lastStatus = 504;
            break;
          }
          throw innerErr;
        }
      }
    }

    if (lastStatus === 504) {
      return res.status(504).json({
        error: "NANDAN AI took too long to respond. Please try again.",
      });
    }

    return res.status(503).json({
      error: "NANDAN AI is experiencing high traffic right now. Please try again in a moment.",
    });
  } catch (err) {
    return res.status(500).json({
      error: "Something went wrong in NANDAN AI. Please try again.",
    });
  }
}
