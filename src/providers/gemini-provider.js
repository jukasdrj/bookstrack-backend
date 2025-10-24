/**
 * Google Gemini AI vision provider
 * Extracted from ai-scanner service for compartmentalization
 *
 * Uses Gemini 2.0 Flash Experimental for high-accuracy bookshelf scanning
 */

/**
 * Scan bookshelf image using Gemini AI
 * @param {ArrayBuffer} imageData - Raw JPEG image data
 * @param {Object} env - Worker environment with GEMINI_API_KEY
 * @returns {Promise<Object>} Scan result with books array
 */
export async function scanImageWithGemini(imageData, env) {
    const startTime = Date.now();

    // Get API key
    const apiKey = env.GEMINI_API_KEY?.get
        ? await env.GEMINI_API_KEY.get()
        : env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not configured');
    }

    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(imageData);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    const base64Image = btoa(binary);

    // Call Gemini API
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            text: `Analyze this bookshelf image and extract all visible book titles and authors. Return a JSON array with this exact format:
[
  {
    "title": "Book Title",
    "author": "Author Name",
    "confidence": 0.95,
    "boundingBox": {
      "x1": 0.1,
      "y1": 0.2,
      "x2": 0.3,
      "y2": 0.4
    }
  }
]

Guidelines:
- confidence: 0.0-1.0 (how certain you are about the text)
- boundingBox: normalized coordinates (0.0-1.0) for the book spine
- Only include books where you can read at least the title
- Skip decorative items, bookends, or non-book objects`
                        },
                        {
                            inline_data: {
                                mime_type: 'image/jpeg',
                                data: base64Image
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,  // Factual output
                    topK: 1,           // Most likely tokens
                    topP: 1,
                    maxOutputTokens: 2048,  // Prevent truncation
                    responseMimeType: 'application/json'  // Force JSON output
                }
            })
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const geminiData = await response.json();

    // Parse response
    const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
        console.error('[GeminiProvider] Empty response');
        return {
            books: [],
            suggestions: [],
            metadata: {
                provider: 'gemini',
                model: 'gemini-2.0-flash-exp',
                timestamp: new Date().toISOString(),
                processingTimeMs: Date.now() - startTime
            }
        };
    }

    // With responseMimeType='application/json', text should be clean JSON
    // Keep markdown stripping as fallback for older API versions
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    const jsonText = jsonMatch ? jsonMatch[1] : text;

    const books = JSON.parse(jsonText);

    if (!Array.isArray(books)) {
        console.error('[GeminiProvider] Response is not an array');
        return {
            books: [],
            suggestions: [],
            metadata: {
                provider: 'gemini',
                model: 'gemini-2.0-flash-exp',
                timestamp: new Date().toISOString(),
                processingTimeMs: Date.now() - startTime
            }
        };
    }

    // Normalize book data
    const normalizedBooks = books.map(book => ({
        title: book.title || '',
        author: book.author || '',
        isbn: book.isbn || null,  // Gemini rarely detects ISBNs, but include field
        confidence: Math.max(0, Math.min(1, parseFloat(book.confidence) || 0.5)),
        boundingBox: {
            x1: Math.max(0, Math.min(1, parseFloat(book.boundingBox?.x1) || 0)),
            y1: Math.max(0, Math.min(1, parseFloat(book.boundingBox?.y1) || 0)),
            x2: Math.max(0, Math.min(1, parseFloat(book.boundingBox?.x2) || 1)),
            y2: Math.max(0, Math.min(1, parseFloat(book.boundingBox?.y2) || 1))
        }
    })).filter(book => book.title.length > 0);

    return {
        books: normalizedBooks,
        suggestions: [],  // Gemini doesn't provide suggestions in current implementation
        metadata: {
            provider: 'gemini',
            model: 'gemini-2.0-flash-exp',
            timestamp: new Date().toISOString(),
            processingTimeMs: Date.now() - startTime
        }
    };
}
