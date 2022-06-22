declare module 'RegexParser' {
  import { Position } from 'Lexer';

  type RegexAST = RegexExpression;

  interface Node {
    type: string;
    raw: string;
    pos: Position;
  }

  interface RegexExpression extends Node {
    type: 'expression';
    pattern: Pattern;
    flags: Flags;
  }

  type Pattern = Disjunction;
  interface Disjunction extends Node {
    type: 'disjunction';
    body: (Alternative | null)[];
  }

  interface Alternative extends Node {
    type: 'alternative';
    body: Term[];
  }

  interface Repetition extends Node {
    type: 'repetition';
    body: Atom;
    quantifier: Quantifier;
  }

  type Term = Assertion | Atom | Repetition;

  type Atom = Character | Escape | CharacterClass | Group | BackReference;

  type BackReference = NameBackedReference | NumberBackedReference;

  interface NameBackedReference extends Node {
    type: 'backReference';
    kind: 'name';
    name: string;
  }

  interface NumberBackedReference extends Node {
    type: 'backReference';
    kind: 'number';
    n: number;
  }

  interface Character extends Node {
    type: 'character';
    kind: 'special' | 'literal';
    char?: string;
  }

  type Escape = CharacterEscape | UnicodePropertyEscape;

  interface CharacterEscape extends Node {
    type: 'escape';
    kind: 'octal' | 'hex' | 'special' | 'literal' | 'unicode' | 'control';
    char: string;
  }

  interface UnicodePropertyEscape extends Node {
    type: 'escape';
    kind: 'unicodeProperty';
    name?: string;
    value?: string;
    negative: boolean;
    binary: boolean;
    nameAlias?: string | string[];
    valueAlias?: string | string[];
    canonicalName: string;
    canonicalValue?: string;
  }

  type Group = CapturingGroup | NoneCapturingGroup | NamedCaptureGroup;

  interface CapturingGroup extends Node {
    type: 'group';
    capturing: true;
    n: number;
    body: Disjunction;
  }

  interface NoneCapturingGroup extends Node {
    type: 'group';
    capturing: false;
    body: Disjunction;
  }

  interface NamedCaptureGroup extends Node {
    type: 'group';
    n: number;
    name: string;
    body: Disjunction;
  }

  type Assertion = Anchor | WordBoundary | Lookaround;

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
    body: Disjunction;
  }

  type CharacterClassBodyItem = Character | Escape | ClassRange;
  interface CharacterClass extends Node {
    type: 'characterClass';
    negative: boolean;
    body: CharacterClassBodyItem[];
  }

  type ClassRangeBody = Character | CharacterEscape;
  interface ClassRange extends Node {
    type: 'classRange';
    from: Required<ClassRangeBody>;
    to: Required<ClassRangeBody>;
  }

  interface Quantifier extends Node {
    type: 'quantifier';
    kind: 'range' | 'symbol';
    greedy: boolean;
    from: number;
    to: number;
  }

  interface Flags extends Omit<Node, 'pos'> {
    type: 'flags';
    body: string;
    global: boolean;
    ignoreCase: boolean;
    multiline: boolean;
    dotAll: boolean;
    unicode: boolean;
    sticky: boolean;
    pos?: Position;
  }
}
