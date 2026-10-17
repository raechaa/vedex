// lib/librechat.ts

import { config } from './config';

export interface LibreChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface LibreChatRequest {
  model: string;
  messages: LibreChatMessage[];
  stream?: boolean;
}

// Struktur response yang diharapkan dari agent
export interface AgentResponse {
  hook_text: string[];
  hashtag: string[];
}

export interface LibreChatResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

/**
 * Call LibreChat agent untuk generate caption hook dan hashtag
 */
export async function callLibreChat(payload: string): Promise<AgentResponse> {
  const requestBody: LibreChatRequest = {
    model: config.librechat.model,
    messages: [
      {
        role: 'user',
        content: payload,
      },
    ],
    stream: false,
  };

  try {
    const response = await fetch(config.librechat.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.librechat.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`LibreChat API error: ${response.status} ${response.statusText}`);
    }

    // Ambil response sebagai text dulu untuk logging
    const responseText = await response.text();

    // Parse response text sebagai JSON
    const data = JSON.parse(responseText);

    const content = data.choices?.[0]?.message?.content || '';

    // Parse content
    const parsed = parseAgentResponse(content);
    
    return parsed;
  } catch (error) {
    console.error('Error calling LibreChat:', error);
    throw error;
  }
}

/**
 * Call LibreChat agent PromptEngineer untuk generate hook script
 */
export async function callPromptEngineer(payload: string): Promise<string> {
  const requestBody: LibreChatRequest = {
    model: config.librechat.promptEngineerModel,
    messages: [
      {
        role: 'user',
        content: payload,
      },
    ],
    stream: false,
  };

  try {
    const response = await fetch(config.librechat.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.librechat.apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`LibreChat API error: ${response.status} ${response.statusText}`);
    }

    const data: LibreChatResponse = await response.json();
    const content = data.choices?.[0]?.message?.content || '';

    return content.trim();
  } catch (error) {
    console.error('Error calling PromptEngineer:', error);
    throw error;
  }
}

/**
 * Parse response JSON dari agent menjadi objek AgentResponse.
 * Menangani berbagai format response yang mungkin.
 */
export function parseAgentResponse(content: string): AgentResponse {
  if (!content) {
    return { hook_text: [], hashtag: [] };
  }

  // Bersihkan content dari markdown code blocks jika ada
  const cleanedContent = content
    .replace(/```json\n?/g, '')
    .replace(/```\n?/g, '')
    .trim();

  // Coba parse sebagai JSON
  try {
    const parsed = JSON.parse(cleanedContent);

    if (parsed && typeof parsed === 'object') {
      let hookTexts: string[] = [];
      let hashtags: string[] = [];

      // --- STRATEGI PARSING ---

      // 1. Cek jika ada key "suggestion" yang berisi array of objects
      if (Array.isArray(parsed.suggestion)) {
        parsed.suggestion.forEach((item: any) => {
          if (item && typeof item === 'object') {
            if (item.hook_text) hookTexts.push(String(item.hook_text).trim());
            if (Array.isArray(item.hashtag)) {
              item.hashtag.forEach((tag: any) => {
                if (typeof tag === 'string') hashtags.push(tag.trim());
              });
            }
          }
        });
      } 
      // 2. Cek jika ada key "hook_text" dan "hashtag" langsung di level root (seperti di log Anda)
      else if (Array.isArray(parsed.hook_text) && Array.isArray(parsed.hashtag)) {
        hookTexts = flattenArray(parsed.hook_text);
        hashtags = flattenArray(parsed.hashtag);
      }
      // 3. Cek jika ada key "hook_text" dan "hashtag" sebagai string
      else if (typeof parsed.hook_text === 'string' && typeof parsed.hashtag === 'string') {
        hookTexts = parsed.hook_text.split('\n').map((item: string) => item.trim()).filter(Boolean);
        hashtags = parsed.hashtag.split(/[\s\n,]+/).map((item: string) => item.trim()).filter(Boolean);
      }
      // 4. Cek jika ada key "captions" dan "hashtags"
      else if (Array.isArray(parsed.captions) && Array.isArray(parsed.hashtags)) {
        hookTexts = flattenArray(parsed.captions);
        hashtags = flattenArray(parsed.hashtags);
      }
      // 5. Cek jika ada nested object "suggestions" (fallback)
      else {
        const data = parsed.suggestions || parsed.data || parsed;
        if (Array.isArray(data.hook_text)) {
          hookTexts = flattenArray(data.hook_text);
        } else if (typeof data.hook_text === 'string') {
          hookTexts = data.hook_text.split('\n').map((item: string) => item.trim()).filter(Boolean);
        } else if (Array.isArray(data.captions)) {
          hookTexts = flattenArray(data.captions);
        } else if (typeof data.captions === 'string') {
          hookTexts = data.captions.split('\n').map((item: string) => item.trim()).filter(Boolean);
        }

        if (Array.isArray(data.hashtag)) {
          hashtags = flattenArray(data.hashtag);
        } else if (typeof data.hashtag === 'string') {
          hashtags = data.hashtag
            .split(/[\s\n,]+/)
            .map((item: string) => item.trim())
            .filter(Boolean);
        } else if (Array.isArray(data.hashtags)) {
          hashtags = flattenArray(data.hashtags);
        } else if (typeof data.hashtags === 'string') {
          hashtags = data.hashtags
            .split(/[\s\n,]+/)
            .map((item: string) => item.trim())
            .filter(Boolean);
        }
      }

      // Remove duplicates
      hookTexts = [...new Set(hookTexts)];
      hashtags = [...new Set(hashtags)];

      const result = { hook_text: hookTexts, hashtag: hashtags };
      return result;
    }
  } catch (e) {
    console.error("Failed to parse agent response JSON:", e);
    
    // Jika gagal parse sebagai JSON, coba parse sebagai plain text
    const lines = cleanedContent.split('\n').filter(Boolean);
    if (lines.length > 0) {
      return { hook_text: lines, hashtag: [] };
    }
  }
  
  return { hook_text: [], hashtag: [] };
}

/**
 * Flatten nested array menjadi array string sederhana
 */
function flattenArray(arr: any[]): string[] {
  const result: string[] = [];
  
  const flatten = (items: any[]) => {
    items.forEach((item) => {
      if (Array.isArray(item)) {
        flatten(item);
      } else if (typeof item === 'string') {
        result.push(item.trim());
      } else if (typeof item === 'object' && item !== null) {
        // Jika item adalah object, coba extract text/content
        if (item.text) {
          result.push(String(item.text).trim());
        } else if (item.content) {
          result.push(String(item.content).trim());
        } else if (item.caption) {
          result.push(String(item.caption).trim());
        } else if (item.hashtag) {
          result.push(String(item.hashtag).trim());
        } else {
          // Jika object tidak punya key yang dikenal, stringify
          result.push(JSON.stringify(item));
        }
      }
    });
  };
  
  flatten(arr);
  return result.filter(Boolean);
}