import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DIALOGUES } from './dataset';

const jsonl = readFileSync(resolve(__dirname, '../../../../data/companion/vi_friend_dialogues.jsonl'), 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map(line => JSON.parse(line) as { messages: Array<{ role: string; content: string }> });

describe('bộ hội thoại mẫu', () => {
    it('dataset.ts khớp từng chữ với file JSONL', () => {
        expect(DIALOGUES).toHaveLength(30);
        expect(jsonl).toHaveLength(30);
        DIALOGUES.forEach((d, i) => {
            const msgs = jsonl[i].messages;
            expect(msgs[0]).toEqual({ role: 'system', content: d.system });
            const flat = d.turns.flatMap(t => [{ role: 'user', content: t.user }, { role: 'assistant', content: t.ai }]);
            expect(msgs.slice(1)).toEqual(flat);
        });
    });

    it('id duy nhất, nhãn xưng hô khớp vai system, mỗi mẫu có ít nhất 1 nhãn', () => {
        expect(new Set(DIALOGUES.map(d => d.id)).size).toBe(30);
        for (const d of DIALOGUES) {
            expect(d.pronoun).toBe(d.system.includes('t–m') ? 't-m' : 'minh-ban');
            expect(d.tags.length).toBeGreaterThan(0);
        }
    });
});
