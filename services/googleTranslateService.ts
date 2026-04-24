// Google Translate API integration for runtime translation of data fields
// Requires: GOOGLE_TRANSLATE_API_KEY in your environment or config

export async function translateText(text: string, targetLang: string, apiKey: string): Promise<string> {
  if (!text || !apiKey) return text;
  const url = 'https://translation.googleapis.com/language/translate/v2';
  const body = {
    q: text,
    target: targetLang,
    format: 'text',
  };
  const params = new URLSearchParams({ key: apiKey });
  try {
    const res = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data && data.data && data.data.translations && data.data.translations[0]) {
      return data.data.translations[0].translatedText;
    }
    return text;
  } catch (e) {
    console.error('Google Translate API error:', e);
    return text;
  }
}

// Usage example (in a React component):
// const translated = await translateText('Some English text', 'ar', apiKey);
