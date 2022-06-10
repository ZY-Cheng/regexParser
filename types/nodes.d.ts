declare module 'RegexParser' {
  import { Position } from 'Lexer';

  type RegexAST = RegexExpression;

  interface Node {
    type: string;
    raw: string;
    pos: Position
  }

  interface RegexExpression extends Node {
    type: 'expression';
    body: {
      pattern: Pattern,
      flags: Flags,
    }
  }

  interface Pattern extends Node {
    type: 'pattern';
    body: (Sequence)[]
  }

  interface Sequence extends Node {
    type: 'sequence';
    body: (Factor | Repetition | Assertion)[] | null
  }

  interface Repetition extends Node {
    type: 'repetition',
    body: { factor: Factor, quantifier: Quantifier }
  }

  interface Factor extends Node {
    type: 'factor';
    body: (Character | Escape | CharacterClass | Group | BackReference)[]
  }

  interface BackReference extends Node {
    type: 'backReference'
    key: string | number;
  }

  interface Character extends Node {
    type: 'character';
    kind: 'special' | 'literal';
  }

  type Escape = SimpleEscape | UnicodePropertyEscape;

  interface SimpleEscape extends Node {
    type: 'escape';
    kind: 'octal' | 'hex' | 'special' | 'literal' | 'utf16' | 'unicode';
    char: string;
  }

  interface UnicodePropertyEscape extends Node {
    type: 'escape';
    kind: 'unicodeProperty';
    name: string;
    value: string;
    negative: boolean;
    fullName: string;
    fullValue: string;
  }

  type Group = CapturingGroup | NonCapturingGroup | NamedCaptureGroup;

  interface CapturingGroup extends Node {
    type: 'group';
    capturing: true;
    n: number;
    body: Pattern
  }

  interface NonCapturingGroup extends Node {
    type: 'group';
    capturing: false;
    body: Pattern
  }

  interface NamedCaptureGroup extends Node {
    type: 'group';
    n: number;
    name: string;
    body: Pattern
  }

  type Assertion = Anchor | WordBoundary;

  interface Anchor extends Node {
    type: 'assertion';
    kind: 'anchor';
  }

  interface WordBoundary extends Node {
    type: 'assertion';
    kind: 'wordBoundary';
    negative: boolean;
  }

  interface Lookaround extends Node {
    type: 'assertion';
    kind: 'lookbehind' | 'lookahead';
    negative: boolean;
    body: Pattern
  }

  interface CharacterClass extends Node {
    type: 'characterClass';
    not: boolean;
    body: (Character | Escape | Range)[]
  }

  interface Range extends Node {
    type: 'range';
    from: Character
    to: Character
  }

  interface Quantifier extends Node {
    type: 'quantifier';
    kind: 'range' | 'symbol';
    greedy: boolean;
    from: number;
    to: number;
  }

  interface Flags extends Node {
    type: 'flags';
    body: Flag[];
    global: boolean;
    ignoreCase: boolean;
    multiline: boolean;
    dotAll: boolean;
    unicode: boolean;
    sticky: boolean
  }

  interface Flag extends Node {
    type: 'flag';
  }
}
