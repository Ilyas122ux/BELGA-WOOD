export function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, '')
    // Excel text must not contain XML-invalid C0 control characters.
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim();
}

export function safeFileSegment(value: string): boolean {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value) && !value.includes('..');
}
