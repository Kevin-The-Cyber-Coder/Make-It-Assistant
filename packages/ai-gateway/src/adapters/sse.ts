export interface SSEEvent {
  event?: string;
  data: string;
}

export async function* parseSSE(response: Response): AsyncGenerator<SSEEvent> {
  if (!response.body) throw new Error('Streaming response has no body');
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const raw = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let event: string | undefined;
      const data: string[] = [];
      for (const line of raw.split(/\r?\n/)) {
        if (line.startsWith('event:')) event = line.slice(6).trim();
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
      }
      if (data.length) yield { event, data: data.join('\n') };
      boundary = buffer.indexOf('\n\n');
    }
    if (done) break;
  }
}

export function safeJson<T>(value: string): T | null {
  if (value === '[DONE]') return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}
