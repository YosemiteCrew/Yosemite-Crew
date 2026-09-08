/**
 * One reader for `globals.css`, shared by every guard that needs the artefact
 * rather than a copy of it.
 *
 * The failure this exists to prevent is the one recorded on #2822: a contrast
 * guard that restates a token's value as a literal keeps passing after the
 * token moves, because its input is a transcript of the file rather than the
 * file. Anything asserting on a token colour should resolve it through here.
 *
 * Kept in `__tests__/support/`, which `jest.config.ts` lists in
 * `testPathIgnorePatterns` - a module of helpers under `__tests__` is otherwise
 * collected as a suite and fails for having no tests.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type Declaration = { line: number; prop: string; value: string };

export type Rule = {
  selector: string;
  /** 1-based line the rule starts on - where its selector begins, not its `{`. */
  open: number;
  /** 1-based line of the `}` that closes it. */
  close: number;
  /** Custom properties declared directly in this rule, in file order. */
  declarations: Declaration[];
};

const DECLARATION = /^\s*(--[\w-]+)\s*:\s*([^;]+);/;
const DECLARATION_START = /^\s*--[\w-]+\s*:/;
const VAR_CHAIN = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]*))?\)$/;

/**
 * Comment text replaced with spaces, newlines kept so every line number still
 * refers to the real file.
 *
 * A comment can span lines, and a token name or a brace inside one reads as
 * code to anything that strips comments a line at a time.
 */
const blankComments = (css: string) =>
  css.replace(/\/\*[\s\S]*?\*\//g, (comment) => comment.replace(/[^\n]/g, ' '));

/**
 * A declaration whose value the formatter wrapped, put back onto one line.
 *
 * `DECLARATION` needs the `;` on the line that names the property, and prettier
 * does not leave it there for a value past the print width - `globals.css` has
 * two such declarations today. Reading only the naming line made them invisible,
 * so a duplicate of either was invisible too and the shadowing scan reported a
 * zero about the file's single-line declarations rather than about the file.
 */
const joinToTerminator = (lines: string[], i: number): string => {
  if (!DECLARATION_START.test(lines[i])) return lines[i];
  let joined = lines[i];
  for (let j = i + 1; j < lines.length && !/[;{}]/.test(joined); j += 1) {
    joined += ` ${lines[j].trim()}`;
  }
  return joined;
};

/**
 * Top-level rules and the custom properties declared directly inside them.
 *
 * Comments are blanked before parsing so a token named inside prose is not read
 * as a declaration, and brace depth is tracked so a declaration nested one level
 * further down does not attach to the enclosing rule.
 */
export const parseRules = (css: string): Rule[] => {
  const rules: Rule[] = [];
  const lines = blankComments(css).split('\n');
  let depth = 0;
  let buffer = '';
  /** 1-based line the current selector started on, so a wrapped one reports its
      first line rather than the line that happens to carry the `{`. */
  let selectorStart = 0;
  let current: Rule | null = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const decl = DECLARATION.exec(joinToTerminator(lines, i));
    if (depth === 1 && decl && current) {
      current.declarations.push({
        line: i + 1,
        prop: decl[1],
        value: decl[2].replace(/\s+/g, ' ').trim(),
      });
    }
    for (const ch of line) {
      if (ch === '{') {
        if (depth === 0)
          current = {
            selector: buffer.trim().replace(/\s+/g, ' '),
            open: selectorStart || i + 1,
            close: -1,
            declarations: [],
          };
        depth += 1;
        buffer = '';
        selectorStart = 0;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0 && current) {
          current.close = i + 1;
          rules.push(current);
          current = null;
        }
        buffer = '';
        selectorStart = 0;
      } else if (ch === ';' && depth === 0) {
        /* A statement at-rule (`@import 'tailwindcss';`) ends here; it is not
           the beginning of the next rule's selector. */
        buffer = '';
        selectorStart = 0;
      } else {
        if (depth === 0 && !selectorStart && ch.trim()) selectorStart = i + 1;
        buffer += ch;
      }
    }
    /* A selector list may be wrapped across lines, so the buffer survives the
       line end rather than being reset by it. */
    if (depth === 0) buffer += ' ';
  }
  return rules;
};

/**
 * Properties this rule declares more than once, with every declaration.
 *
 * At equal specificity the last one wins, so every earlier copy is dead text
 * that an editor will nonetheless read, edit, and watch do nothing.
 */
export const duplicatesWithin = (rule: Rule): { prop: string; declarations: Declaration[] }[] => {
  const byProp = new Map<string, Declaration[]>();
  for (const d of rule.declarations) {
    const seen = byProp.get(d.prop);
    if (seen) seen.push(d);
    else byProp.set(d.prop, [d]);
  }
  return [...byProp.entries()]
    .filter(([, declarations]) => declarations.length > 1)
    .map(([prop, declarations]) => ({ prop, declarations }));
};

const isDarkRule = (selector: string) => /data-theme\s*=\s*['"]?dark/.test(selector);

/**
 * `@theme` is Tailwind 4's base layer and is theme-independent, so it belongs
 * in the light map or tokens that only alias through it resolve to nothing -
 * and a missing value would compare "" against "" and read as a pass.
 * More than one rule matches the dark selector, so these accumulate in file
 * order and let the later one win, exactly as the cascade does.
 */
export const themeMaps = (rules: Rule[]) => {
  const light = new Map<string, string>();
  const dark = new Map<string, string>();
  for (const rule of rules) {
    const isBase =
      rule.selector.split(',').some((part) => part.trim() === ':root') ||
      rule.selector.trim().startsWith('@theme');
    if (!isDarkRule(rule.selector) && !isBase) continue;
    for (const d of rule.declarations) {
      if (isDarkRule(rule.selector)) dark.set(d.prop, d.value);
      else light.set(d.prop, d.value);
    }
  }
  return { light, dark };
};

export const GLOBALS_CSS_PATH = join(process.cwd(), 'src/app/globals.css');
export const GLOBALS_CSS = readFileSync(GLOBALS_CSS_PATH, 'utf8');
export const RULES = parseRules(GLOBALS_CSS);

const { light: LIGHT, dark: DARK } = themeMaps(RULES);
export { LIGHT, DARK };

/** Follows a `var(--a, fallback)` chain down to a literal colour. */
export const resolve = (value: string, dark: boolean): string => {
  let current = value;
  for (let i = 0; i < 12; i += 1) {
    const m = VAR_CHAIN.exec(current.trim());
    if (!m) return current.trim();
    const next = (dark ? DARK.get(m[1]) : undefined) ?? LIGHT.get(m[1]) ?? m[2];
    if (next === undefined) return current.trim();
    current = next;
  }
  return current.trim();
};

/**
 * `resolve`, with the silent miss made loud.
 *
 * A token that resolves to nothing hands a contrast probe an empty string,
 * which it reads as black on white - a comfortable pass on a dead instrument.
 */
export const resolveColour = (token: string, dark: boolean): string => {
  const literal = resolve(token, dark);
  if (!/^(#|rgb)/.test(literal)) {
    throw new Error(
      `${token} did not resolve to a colour in ${dark ? 'dark' : 'light'}: "${literal}"`
    );
  }
  return literal;
};
