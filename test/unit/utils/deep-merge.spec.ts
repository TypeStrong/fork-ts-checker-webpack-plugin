import { deepMerge } from 'src/utils/deep-merge';

describe('deepMerge', () => {
  it('merges nested objects and lets the source win', () => {
    expect(
      deepMerge(
        { async: true, typescript: { build: false, mode: 'readonly' } },
        { typescript: { build: true }, devServer: false }
      )
    ).toEqual({
      async: true,
      typescript: { build: true, mode: 'readonly' },
      devServer: false,
    });
  });

  it('concatenates arrays', () => {
    expect(
      deepMerge({ issue: { include: [{ file: 'a' }] } }, { issue: { include: ['b'] } })
    ).toEqual({ issue: { include: [{ file: 'a' }, 'b'] } });
  });

  it('replaces a value when only one side is an array', () => {
    expect(deepMerge({ include: { file: 'a' } }, { include: ['b'] })).toEqual({ include: ['b'] });
    expect(deepMerge({ include: ['b'] }, { include: { file: 'a' } })).toEqual({
      include: { file: 'a' },
    });
  });

  it('keeps functions, regular expressions and dates by reference', () => {
    const formatter = () => 'formatted';
    const pattern = /test/;
    const date = new Date();

    const merged = deepMerge({ formatter: 'basic', pattern: {} }, { formatter, pattern, date });

    expect(merged.formatter).toBe(formatter);
    expect(merged.pattern).toBe(pattern);
    expect(merged.date).toBe(date);
  });

  it("doesn't modify or share its inputs", () => {
    const target = { typescript: { configOverwrite: { include: ['a'] } } };
    const source = { typescript: { configOverwrite: { include: ['b'] } } };

    const merged = deepMerge(target, source);
    merged.typescript.configOverwrite.include.push('c');

    expect(target).toEqual({ typescript: { configOverwrite: { include: ['a'] } } });
    expect(source).toEqual({ typescript: { configOverwrite: { include: ['b'] } } });
  });

  it("doesn't let a `__proto__` key change the prototype of the result", () => {
    const merged = deepMerge(
      JSON.parse('{ "__proto__": { "polluted": true }, "nested": {} }'),
      JSON.parse('{ "nested": { "__proto__": { "polluted": true } } }')
    );

    expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
    expect(Object.getPrototypeOf(merged.nested)).toBe(Object.prototype);
    expect(merged.polluted).toBeUndefined();
    expect(merged.nested.polluted).toBeUndefined();
  });
});
