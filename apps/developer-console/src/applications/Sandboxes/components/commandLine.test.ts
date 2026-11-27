import { describe, expect, it } from 'vitest';

import { parseKeyValues, quoteArg, splitCommand } from './commandLine';

describe('splitCommand', () => {
  it('splits words and keeps quoted spaces', () => {
    expect(splitCommand(`python -c "print('hello from a DDC sandbox')"`).args).toEqual([
      'python',
      '-c',
      "print('hello from a DDC sandbox')",
    ]);
    expect(splitCommand(`sh -c 'echo "a b" | wc -c'`).args).toEqual(['sh', '-c', 'echo "a b" | wc -c']);
    expect(splitCommand('  sleep   infinity ').args).toEqual(['sleep', 'infinity']);
    expect(splitCommand(`a\\ b "" c`).args).toEqual(['a b', '', 'c']);
  });
  it('reports an open quote', () => {
    expect(splitCommand(`echo "x`).error).toMatch(/double quote/);
  });
  it('round-trips through quoteArg', () => {
    const args = ['python', '-c', "print('x y')", '', 'a"b'];
    expect(splitCommand(args.map(quoteArg).join(' ')).args).toEqual(args);
  });
});

describe('parseKeyValues', () => {
  it('parses lines and keeps = in values', () => {
    expect(parseKeyValues('A=1\n\nB = x=y\n')).toEqual({ values: { A: '1', B: ' x=y' }, error: null });
    expect(parseKeyValues('nope').error).toMatch(/Line 1/);
  });
});
