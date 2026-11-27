/**
 * Form helpers for the New sandbox dialog: a command line typed as text into
 * the API's argv array, and `KEY=value` lines into a map.
 */

/**
 * Split a command line the way a POSIX shell splits words: whitespace
 * separates; single quotes keep everything literally; double quotes keep
 * spaces and honour `\"` and `\\`; a backslash outside quotes escapes the next
 * character. No expansion of any kind.
 */
export function splitCommand(line: string): { args: string[]; error: string | null } {
  const args: string[] = [];
  let cur = '';
  let inWord = false;
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quote === "'") {
      if (ch === "'") quote = null;
      else cur += ch;
    } else if (quote === '"') {
      if (ch === '"') quote = null;
      else if (ch === '\\' && (line[i + 1] === '"' || line[i + 1] === '\\')) cur += line[++i];
      else cur += ch;
    } else if (ch === "'" || ch === '"') {
      quote = ch;
      inWord = true;
    } else if (ch === '\\' && i + 1 < line.length) {
      cur += line[++i];
      inWord = true;
    } else if (/\s/.test(ch)) {
      if (inWord) args.push(cur);
      cur = '';
      inWord = false;
    } else {
      cur += ch;
      inWord = true;
    }
  }
  if (quote) return { args: [], error: `A ${quote === '"' ? 'double' : 'single'} quote is not closed.` };
  if (inWord) args.push(cur);
  return { args, error: null };
}

/** Quote one argument for display, so `splitCommand(join(args))` gives `args` back. */
export function quoteArg(a: string): string {
  return a === '' || /[\s'"\\$`|&;<>(){}*?!#~]/.test(a) ? `'${a.replace(/'/g, `'\\''`)}'` : a;
}

/** `KEY=value` per line; blank lines ignored; the first `=` splits. */
export function parseKeyValues(text: string): { values: Record<string, string>; error: string | null } {
  const values: Record<string, string> = {};
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) return { values: {}, error: `Line ${i + 1} is not KEY=value.` };
    values[line.slice(0, eq).trim()] = line.slice(eq + 1);
  }
  return { values, error: null };
}
