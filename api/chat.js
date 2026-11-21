export default async function handler(req, res) {

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Only POST requests are allowed"
    });
  }

  try {

    // API KEY
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY not found in Vercel"
      });
    }

    // USER INPUT
    const {
      message,
      history = [],
      imageBase64,
      mimeType,
      language = "Auto"
    } = req.body || {};

    if (!message && !imageBase64) {
      return res.status(400).json({
        error: "Message or image is required"
      });
    }

    // IMAGE SUPPORT
    const parts = [];

    if (imageBase64 && mimeType) {
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: imageBase64
        }
      });
    }

    if (message) {
      parts.push({
        text: message
      });
    }

    // CHAT HISTORY
    const safeHistory = Array.isArray(history)
      ? history.slice(-10).filter(item =>
          item &&
          ["user", "model"].includes(item.role) &&
          Array.isArray(item.parts)
        )
      : [];

    const contents = [
      ...safeHistory,
      {
        role: "user",
        parts: parts
      }
    ];

    // GEMINI API
    const url =
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent";

    const response = await fetch(url, {

      method: "POST",

      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey.trim()
      },

      body: JSON.stringify({

        system_instruction: {
          parts: [
            {
              text:
                `You are NANDAN AI, a helpful smart assistant.
                Reply clearly and naturally.
                Support Hindi, Gujarati and English.
                Preferred language: ${language}.
                Explain difficult topics simply.
                Give accurate and useful answers.
                Be friendly and professional.`
            }
          ]
        },

        contents: contents,

        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2048
        }

      })

    });

    // API RESPONSE
    const data = await response.json();

    if (!response.ok) {

      return res.status(response.status).json({
        error:
          data.error?.message || "Gemini API request failed"
      });

    }

    // EXTRACT ANSWER
    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .filter(Boolean)
      .join("\n");

    if (!reply) {
      return res.status(502).json({
        error: "No response received from Gemini AI"
      });
    }

    // SUCCESS
    return res.status(200).json({
      reply: reply
    });

  } catch (error) {

    console.error("NANDAN AI ERROR:", error);

    return res.status(500).json({
      error: "Server error: " + error.message
    });

  }

}
