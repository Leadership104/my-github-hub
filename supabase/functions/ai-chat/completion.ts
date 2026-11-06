// Reasoning models can spend part of max_tokens before producing visible text.
export function isBriefingRequest(message: string, requested: unknown): boolean {
  return requested === true || message === 'agentic-briefing' ||
    /\b(?:brief me|know before you go briefing)\b/i.test(message);
}

export function isCompleteChoice(choice: any): boolean {
  return choice?.finish_reason === 'stop' &&
    typeof choice?.message?.content === 'string' &&
    choice.message.content.trim().length > 0;
}

export async function requestCompleteReply(
  request: (maxTokens: number) => Promise<Response>,
  initialBudget: number,
): Promise<Response> {
  const response = await request(initialBudget);
  if (!response.ok) return response;
  const data = await response.clone().json();
  if (isCompleteChoice(data.choices?.[0])) return response;
  // Regenerate the entire answer, not a fragment the user has to piece together.
  const retry = await request(8192);
  if (!retry.ok) return retry;
  const retryData = await retry.clone().json();
  if (!isCompleteChoice(retryData.choices?.[0])) {
    throw new Error('The AI could not finish the reply. Please try again.');
  }
  return retry;
}