// File: src/services/ai/streamParser.ts
// Phần thuần (không gọi mạng) của streaming: tách Server-Sent Events và gộp các gói JSON của Gemini
// thành một phản hồi đầy đủ như khi gọi không stream. Tách riêng để test bằng vitest.

export interface SseEvent {
    event: string | null;
    data: string;
}

// Tách luồng chữ SSE thành từng sự kiện. Gói mạng có thể cắt giữa dòng nên phải giữ phần dư.
export function createSseParser(onEvent: (e: SseEvent) => void) {
    let buffer = '';

    const emitBlock = (block: string) => {
        let event: string | null = null;
        const data: string[] = [];
        for (const line of block.split(/\r?\n/)) {
            if (!line || line.startsWith(':')) continue;
            const colon = line.indexOf(':');
            const field = colon === -1 ? line : line.slice(0, colon);
            let value = colon === -1 ? '' : line.slice(colon + 1);
            if (value.startsWith(' ')) value = value.slice(1);
            if (field === 'event') event = value;
            else if (field === 'data') data.push(value);
        }
        if (data.length) onEvent({ event, data: data.join('\n') });
    };

    return {
        push(chunk: string) {
            buffer += chunk;
            let match: RegExpExecArray | null;
            const sep = /\r?\n\r?\n/g;
            let last = 0;
            while ((match = sep.exec(buffer)) !== null) {
                emitBlock(buffer.slice(last, match.index));
                last = match.index + match[0].length;
            }
            buffer = buffer.slice(last);
        },
        flush() {
            if (buffer.trim()) emitBlock(buffer);
            buffer = '';
        },
    };
}

// Một phần trong content của Gemini (text / suy nghĩ / gọi hàm…), giữ nguyên các trường lạ như thoughtSignature
export type GeminiPart = Record<string, any>;

export interface ChunkDelta {
    text: string;
    thought: string;
    functionCalls: Array<{ name: string; args: Record<string, any> }>;
}

// Gộp các gói stream. Quy tắc:
//  - text liên tiếp cùng loại (suy nghĩ / trả lời) được nối lại cho gọn;
//  - phần có thoughtSignature (bắt buộc gửi lại với họ Gemini 3 khi gọi hàm) không bao giờ bị nối/tách,
//    đúng hướng dẫn "không gộp phần có chữ ký với phần không có chữ ký".
export function createResponseAccumulator() {
    const parts: GeminiPart[] = [];
    let finishReason: string | undefined;
    let usageMetadata: any = null;
    let promptFeedback: any = null;
    let hasCandidate = false;

    const appendText = (part: GeminiPart) => {
        const prev = parts[parts.length - 1];
        const isThought = part.thought === true;
        const canMerge =
            prev &&
            typeof prev.text === 'string' &&
            (prev.thought === true) === isThought &&
            !prev.thoughtSignature &&
            !part.thoughtSignature &&
            Object.keys(part).every((k) => k === 'text' || k === 'thought');
        if (canMerge) prev.text += part.text;
        else parts.push({ ...part });
    };

    return {
        add(chunk: any): ChunkDelta {
            const delta: ChunkDelta = { text: '', thought: '', functionCalls: [] };
            if (!chunk || typeof chunk !== 'object') return delta;
            if (chunk.usageMetadata) usageMetadata = chunk.usageMetadata;
            if (chunk.promptFeedback) promptFeedback = chunk.promptFeedback;

            const candidate = chunk.candidates?.[0];
            if (!candidate) return delta;
            hasCandidate = true;
            if (candidate.finishReason) finishReason = candidate.finishReason;

            for (const part of candidate.content?.parts || []) {
                if (part.functionCall) {
                    parts.push({ ...part });
                    delta.functionCalls.push(part.functionCall);
                } else if (typeof part.text === 'string') {
                    appendText(part);
                    if (part.thought === true) delta.thought += part.text;
                    else delta.text += part.text;
                } else {
                    parts.push({ ...part });
                }
            }
            return delta;
        },

        // Cùng hình dạng với phản hồi generateContent không stream → phần xử lý phía sau dùng chung
        result() {
            const data: any = { usageMetadata };
            if (promptFeedback) data.promptFeedback = promptFeedback;
            if (hasCandidate) {
                data.candidates = [{
                    content: { role: 'model', parts },
                    ...(finishReason ? { finishReason } : {}),
                }];
            }
            return data;
        },
    };
}
