import { describe, expect, test } from 'bun:test';
import { isBriefingRequest, isCompleteChoice, requestCompleteReply } from './completion';

const result = (reason: string, text: string) => new Response(JSON.stringify({
  choices: [{ finish_reason: reason, message: { content: text } }],
}));

describe('complete briefings', () => {
  test('Brief me uses the full briefing path, like automatic briefings', () => {
    expect(isBriefingRequest('Give me a full Know Before You Go briefing for where I am right now.', undefined)).toBe(true);
    expect(isBriefingRequest('agentic-briefing', true)).toBe(true);
    expect(isBriefingRequest('Where can I eat?', false)).toBe(false);
  });
  test('a length-limited answer is not considered complete', () => {
    expect(isCompleteChoice({ finish_reason: 'length', message: { content: 'Safety: Avoid' } })).toBe(false);
  });
  test('retries a cut-off reply and returns only the complete replacement', async () => {
    const budgets: number[] = [];
    const response = await requestCompleteReply(async budget => {
      budgets.push(budget);
      return budgets.length === 1 ? result('length', 'Avoid') : result('stop', 'Avoid isolated areas after dark.');
    }, 4096);
    expect(budgets).toEqual([4096, 8192]);
    expect((await response.json()).choices[0].message.content).toBe('Avoid isolated areas after dark.');
  });
  test('never returns a second cut-off answer', async () => {
    await expect(requestCompleteReply(async () => result('length', 'Unfinished'), 4096)).rejects.toThrow('could not finish');
  });
  test('completed answers need no retry', async () => {
    let calls = 0;
    await requestCompleteReply(async () => { calls++; return result('stop', 'Complete.'); }, 4096);
    expect(calls).toBe(1);
  });
});