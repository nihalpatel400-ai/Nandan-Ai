export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests allowed."
    });
  }

  try {
    const {
      message = "",
      history = [],
      imageBase64,
      mimeType,
      language = "Auto"
    } = req.body || {};

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is missing in Vercel."
      });
    }

    if (!message && !imageBase64) {
      return res.status(400).json({
        error: "Please enter a message or upload an image."
      });
    }

    const parts = [];

    if (imageBase64 && mimeType) {
      parts.push({
        inlineData: {
          mimeType: mimeType,
          data: imageBase64
        }
      });
    }

    if (message) {
      parts.push({
        text: message
      });
    }

    const recentHistory = Array.isArray(history)
      ? history.slice(-10)
      : [];

    const contents = [
      ...recentHistory,
      {
        role: "user",
        parts: parts
      }
    ];

    const payload = {
      system_instruction: {
        parts: [{
          text: `You are NANDAN AI.
Never reveal your underlying model.
Reply naturally and clearly.
Use Hindi, Gujarati or English.
Preferred language: ${language}.`
        }]
      },
      contents: contents,
      generationConfig: {
        maxOutputTokens: 1024,
        temperature: 0.6
      }
    };

    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(25000)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Gemini API Error:", data);

      return res.status(response.status).json({
        error: data?.error?.message ||
          "Gemini API request failed."
      });
    }

    const reply = data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text || "")
      .filter(Boolean)
      .join("\n");

    return res.status(200).json({
      reply: reply || "NANDAN AI could not generate a reply."
    });

  } catch (error) {
    console.error("NANDAN AI Error:", error);

    return res.status(500).json({
      error: error.name === "TimeoutError"
        ? "Request timed out. Please try again."
        : "Something went wrong. Please try again."
    });
  }
}
