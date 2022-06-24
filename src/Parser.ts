import * as RegexParser from 'RegexParser';
import {
  Position, States, Token, TokenTypes,
} from 'Lexer';
import {
  INVALID_CHARACTER_CLASS_ERROR,
  CLASS_RANGE_OUT_OF_ORDER_ERROR,
  INVALID_FLAG_ERROR,
  INVALID_NAMED_CAPTURE_REFERENCED_ERROR,
  INVALID_QUANTIFIER_ERROR,
  INVALID_QUANTIFIER_NUMBERS_ERROR,
  INVALID_REGEX_ERROR,
  INVALID_UNICODE_PROPERTY_NAME_ERROR,
  INVALID_UNICODE_PROPERTY_VALUE_ERROR,
  syntaxError,
  MISSING_PATTERN_END_ERROR,
} from './error';
import { Lexer } from './Lexer';
import { rules } from './rules';
import {
  getUnicodePropertyInfo,
  getUnicodePropertyInfoFromName,
  getUnicodePropertyInfoFromValue,
  UnicodePropertyInfo,
} from './unicodeProperty/helper';

// eslint-disable-next-line consistent-return
function createPosition(position?: Position): Position | undefined {
  if (position) {
    const pos = position;
    return {
      start: {
        line: pos.start.line,
        column: pos.start.column,
      },
      end: {
        line: pos.end.line,
        column: pos.end.column,
      },
    };
  }
}

function hexToChar(kind: 'utf16CodeUnit' | 'codePoint', ...hexs: string[]) {
  const hexDecimals = hexs.map((hex) => Number.parseInt(hex, 16));
  if (kind === 'utf16CodeUnit') {
    return String.fromCharCode(...hexDecimals);
  }
  return String.fromCodePoint(...hexDecimals);
}

function octalToChar(octal: string) {
  return String.fromCharCode(Number.parseInt(octal, 8));
}

function isUnicodePropertyEscape(
  node: RegexParser.Node,
): node is RegexParser.UnicodePropertyEscape {
  return (node as RegexParser.UnicodePropertyEscape).kind === 'unicodeProperty';
}

const specialEscape = new Map([
  // eslint-disable-next-line no-useless-escape
  ['\\d', '\d'],
  // eslint-disable-next-line no-useless-escape
  ['\\D', '\D'],
  // eslint-disable-next-line no-useless-escape
  ['\\w', '\w'],
  // eslint-disable-next-line no-useless-escape
  ['\\W', '\W'],
  // eslint-disable-next-line no-useless-escape
  ['\\s', '\s'],
  // eslint-disable-next-line no-useless-escape
  ['\\S', '\S'],
  ['\\t', '\t'],
  ['\\r', '\r'],
  ['\\n', '\n'],
  ['\\v', '\v'],
  ['\\f', '\f'],
  ['\\v', '\v'],
  ['\\b', '\b'],
  // eslint-disable-next-line no-useless-escape
  ['\\B', '\B'],
]);

type TokenInfo = TokenTypes | {
  type: TokenTypes;
  raw: string;
};

export class Parser {
  text: string;

  ast: RegexParser.RegexAST | null = null;

  lexer: Lexer;

  private get lookahead() {
    return this.lexer.getNextToken(false);
  }

  private get namedGroups() {
    return this.lexer.namedGroups;
  }

  private get capturingGroupsCount() {
    return this.lexer.capturingGroupsCount;
  }

  private isInCharacterClass = false;

  constructor() {
    this.lexer = new Lexer();
  }

  parse(regStr: string) {
    this.init(regStr);

    this.lexer.init(regStr);
    this.setLexerState();
    this.lexer.scan();

    this.ast = this.Expression();
    return this.ast;
  }

  private Expression(): RegexParser.RegexExpression {
    const startToken = this.consumeToken(TokenTypes.SLASH);
    const pos = createPosition(startToken.value.position)!;
    const pattern = this.Pattern();
    this.consumeToken(TokenTypes.SLASH);
    const flags = this.Flags();

    pos.end.line = flags.pos ? flags.pos.end.line : pattern.pos.end.line;
    pos.end.column = flags.pos ? flags.pos.end.column : pattern.pos.end.column;

    return {
      type: 'expression',
      pattern,
      flags,
      pos,
      raw: this.text,
    };
  }

  private Pattern(): RegexParser.Pattern {
    return this.Disjunction();
  }

  private Disjunction(): RegexParser.Disjunction {
    let node: RegexParser.Alternative | null;
    let pos: Position;
    const alternatives: (RegexParser.Alternative | null)[] = [];

    node = this.Alternative();
    if (node) {
      pos = createPosition(node.pos)!;
    } else {
      const { position } = this.lookahead!.value;
      pos = {
        start: {
          line: position.start.line,
          column: position.start.column,
        },
        end: {
          line: position.start.line,
          column: position.start.column,
        },
      };
    }
    alternatives.push(node);

    while (this.ifLookaheadIs(TokenTypes.ALTERNATION)) {
      const token = this.consumeToken(TokenTypes.ALTERNATION);
      node = this.Alternative();
      alternatives.push(node);
      if (node === null) {
        pos.end.line = token.value.position.end.line;
        pos.end.column = token.value.position.end.column;
      } else {
        pos.end.line = node.pos.end.line;
        pos.end.column = node.pos.end.column;
      }
    }

    return {
      type: 'disjunction',
      body: alternatives,
      raw: this.getText(pos),
      pos,
    };
  }

  private Alternative(): RegexParser.Alternative | null {
    const isTerminator = () => this.ifLookaheadIs([
      TokenTypes.SLASH,
      TokenTypes.RIGHT_PARENTHESIS,
      TokenTypes.ALTERNATION,
    ]);

    if (isTerminator()) {
      return null;
    }

    const terms: RegexParser.Term[] = [];
    while (!isTerminator()) {
      terms.push(this.Term());
    }
    const pos = createPosition(terms[0].pos)!;
    pos.end.line = terms[terms.length - 1]!.pos.end.line;
    pos.end.column = terms[terms.length - 1]!.pos.end.column;
    return {
      type: 'alternative',
      body: terms,
      raw: this.getText(pos),
      pos,
    };
  }

  private Term(): RegexParser.Term {
    if (this.ifLookaheadIs([TokenTypes.BEGIN_OF_INPUT, TokenTypes.END_OF_INPUT,
      TokenTypes.LOOKAHEAD_START, TokenTypes.LOOKBEHIND_START,
      TokenTypes.NEGATIVE_LOOKAHEAD_START, TokenTypes.NEGATIVE_LOOKBEHIND_START,
      { type: TokenTypes.ESCAPE, raw: '\\b' }, { type: TokenTypes.ESCAPE, raw: '\\B' }])
    ) {
      return this.Assertion();
    }

    if (this.ifLookaheadIs([
      TokenTypes.STAR,
      TokenTypes.PLUS,
      TokenTypes.MARK,
      TokenTypes.LEFT_BRACE,
    ])) {
      throw syntaxError({
        line: this.lookahead!.value.position.start.line,
        column: this.lookahead!.value.position.start.column,
      }, INVALID_QUANTIFIER_ERROR);
    }
    const atom = this.Atom();
    if (this.ifLookaheadIs([
      TokenTypes.STAR,
      TokenTypes.PLUS,
      TokenTypes.MARK,
      TokenTypes.LEFT_BRACE,
    ])) {
      return this.Repetition(atom);
    }

    return atom;
  }

  private Assertion(): RegexParser.Assertion {
    if (this.ifLookaheadIs([TokenTypes.BEGIN_OF_INPUT, TokenTypes.END_OF_INPUT])) {
      return this.Anchor();
    } if (this.ifLookaheadIs([TokenTypes.LOOKAHEAD_START, TokenTypes.LOOKBEHIND_START,
      TokenTypes.NEGATIVE_LOOKAHEAD_START, TokenTypes.NEGATIVE_LOOKBEHIND_START])
    ) {
      return this.Lookaround();
    }
    return this.WordBoundary();
  }

  private Anchor(): RegexParser.Anchor {
    const token = this.consumeToken([TokenTypes.BEGIN_OF_INPUT, TokenTypes.END_OF_INPUT]);
    return {
      type: 'assertion',
      kind: 'anchor',
      raw: token.value.raw,
      pos: token.value.position,
    };
  }

  private WordBoundary(): RegexParser.WordBoundary {
    const token = this.consumeToken([{ type: TokenTypes.ESCAPE, raw: '\\b' }, { type: TokenTypes.ESCAPE, raw: '\\B' }]);
    return {
      type: 'assertion',
      kind: 'wordBoundary',
      negative: token.value.raw === '\\B',
      raw: token.value.raw,
      pos: token.value.position,
    };
  }

  private Lookaround(): RegexParser.Lookaround {
    const startToken = this.consumeToken(
      [TokenTypes.LOOKAHEAD_START, TokenTypes.LOOKBEHIND_START,
        TokenTypes.NEGATIVE_LOOKAHEAD_START, TokenTypes.NEGATIVE_LOOKBEHIND_START],
    );
    const pos = createPosition(startToken.value.position)!;
    const disjunction = this.Disjunction();
    const endToken = this.consumeToken(TokenTypes.RIGHT_PARENTHESIS);
    pos.end.line = endToken.value.position.end.line;
    pos.end.column = endToken.value.position.end.column;
    return {
      type: 'assertion',
      kind: startToken.type === TokenTypes.NEGATIVE_LOOKBEHIND_START
      || startToken.type === TokenTypes.LOOKBEHIND_START
        ? 'lookbehind' : 'lookahead',
      negative: startToken.type === TokenTypes.NEGATIVE_LOOKBEHIND_START
      || startToken.type === TokenTypes.NEGATIVE_LOOKAHEAD_START,
      body: disjunction,
      raw: this.getText(pos),
      pos,
    };
  }

  private Atom(): RegexParser.Atom {
    if (this.ifLookaheadIs([
      TokenTypes.LEFT_SQUARE_BRACKET,
      TokenTypes.NEGATIVE_CHARACTER_CLASS_START,
    ])) {
      return this.CharacterClass();
    } if (this.ifLookaheadIs([
      TokenTypes.LEFT_PARENTHESIS,
      TokenTypes.NON_CAPTURING_GROUP_START,
      TokenTypes.NAMED_CAPTURING_GROUP_START,
    ])) {
      return this.Group();
    } if (this.ifLookaheadIs([
      TokenTypes.UNICODE_PROPERTY_ESCAPE,
      TokenTypes.ESCAPE,
      TokenTypes.HEX_ESCAPE,
      TokenTypes.NUMBER_ESCAPE,
      TokenTypes.CONTROL_ESCAPE,
      TokenTypes.UNICODE_ESCAPE,
    ])) {
      const backReference = this.BackReference();
      if (backReference) {
        return backReference;
      }
      return this.Escape();
    }
    return this.Character();
  }

  private Character(): RegexParser.Character {
    let token: Token;
    if (this.isInCharacterClass) {
      token = this.consumeToken([
        TokenTypes.CHARACTER,
        TokenTypes.ANY_CHARACTER,
        TokenTypes.DASH,
      ]);
    } else {
      token = this.consumeToken([TokenTypes.CHARACTER, TokenTypes.ANY_CHARACTER]);
    }

    return {
      type: 'character',
      kind: token.type === TokenTypes.ANY_CHARACTER ? 'special' : 'literal',
      char: token.type === TokenTypes.ANY_CHARACTER ? undefined : token.value.raw,
      raw: token.value.raw,
      pos: token.value.position,
    };
  }

  private Escape(): RegexParser.Escape {
    if (this.ifLookaheadIs(TokenTypes.UNICODE_PROPERTY_ESCAPE)) {
      return this.UnicodePropertyEscape();
    }
    return this.CharacterEscape();
  }

  private CharacterEscape(): RegexParser.CharacterEscape {
    let token = this.consumeToken([
      TokenTypes.ESCAPE,
      TokenTypes.HEX_ESCAPE,
      TokenTypes.NUMBER_ESCAPE,
      TokenTypes.CONTROL_ESCAPE,
      TokenTypes.UNICODE_ESCAPE,
    ]);
    const pos = createPosition(token.value.position)!;

    let kind: 'octal' | 'hex' | 'special' | 'literal' | 'unicode' | 'control';
    let char: string;
    let { raw } = token.value;
    if (token.type === TokenTypes.NUMBER_ESCAPE) {
      if (raw.match(rules.octalDigit)) {
        kind = 'octal';

        const num = Number(raw.slice(-1));
        const loopLimit = num <= 3 ? 2 : 1;
        for (let i = 0; i < loopLimit; i++) {
          if (
            this.lookahead?.type === TokenTypes.CHARACTER
            && this.lookahead.value.raw.match(rules.octalDigit)
          ) {
            token = this.consumeToken(TokenTypes.CHARACTER);
            raw += token.value.raw;
          }
        }
        char = octalToChar(raw.replace('\\', ''));
      } else {
        kind = 'literal';
        char = raw.slice(1);
      }
    } else if (token.type === TokenTypes.HEX_ESCAPE) {
      kind = 'hex';
      char = hexToChar('utf16CodeUnit', raw.replace('\\x', ''));
    } else if (token.type === TokenTypes.CONTROL_ESCAPE) {
      kind = 'control';
      const startCodePoint = 'a'.codePointAt(0)!;
      char = String.fromCodePoint(raw.slice(2).toLowerCase().codePointAt(0)! - startCodePoint + 1);
    } else if (token.type === TokenTypes.UNICODE_ESCAPE) {
      kind = 'unicode';
      if (raw.match(rules.unicode)) {
        char = hexToChar('utf16CodeUnit', raw.match(rules.unicode)![1]);
      } else {
        char = hexToChar('codePoint', raw.match(rules.unicodeInUnicodeFlag)![1]);
      }
    } else if ((this.isInCharacterClass && raw.match(rules.metaEscape))
      || (!this.isInCharacterClass && raw.match(rules.specEscape))
    ) {
      kind = 'special';
      char = specialEscape.get(raw)!;
    } else {
      kind = 'literal';
      char = raw.slice(1)!;
    }

    pos.end.line = token.value.position.end.line;
    pos.end.column = token.value.position.end.column;

    return {
      type: 'escape',
      kind,
      char,
      raw,
      pos,
    };
  }

  private UnicodePropertyEscape(): RegexParser.UnicodePropertyEscape {
    const token = this.consumeToken(
      TokenTypes.UNICODE_PROPERTY_ESCAPE,
    );
    const pos = createPosition(token.value.position)!;
    const { raw } = token.value;
    const matchArr = raw.match(rules.unicodeProperty);
    const nameOrValue = matchArr![1];
    const value = matchArr![2];
    let info: UnicodePropertyInfo | undefined;
    if (value) {
      info = getUnicodePropertyInfoFromName(nameOrValue);
      if (!info) {
        throw syntaxError({
          line: token.value.position.start.line,
          column: token.value.position.start.column,
        }, INVALID_UNICODE_PROPERTY_NAME_ERROR);
      }
      const valueInfo = getUnicodePropertyInfoFromValue(value, info.canonicalName);
      if (!valueInfo) {
        throw syntaxError({
          line: token.value.position.start.line,
          column: token.value.position.start.column,
        }, INVALID_UNICODE_PROPERTY_VALUE_ERROR);
      }
      info = Object.assign(info, valueInfo);
    } else {
      info = getUnicodePropertyInfo(nameOrValue);
      if (!info) {
        throw syntaxError({
          line: token.value.position.start.line,
          column: token.value.position.start.column,
        }, INVALID_UNICODE_PROPERTY_NAME_ERROR);
      }
    }

    const nonBinaryName = value ? nameOrValue : undefined;
    return {
      type: 'escape',
      kind: 'unicodeProperty',
      name: info.binary ? nameOrValue : nonBinaryName,
      value: info.binary ? undefined : value || nameOrValue,
      binary: info.binary,
      negative: token.value.raw.slice(1) === 'P',
      nameAlias: info.nameAlias,
      valueAlias: info.valueAlias || undefined,
      canonicalName: info.canonicalName,
      canonicalValue: info.canonicalValue,
      raw,
      pos,
    };
  }

  private CharacterClass(): RegexParser.CharacterClass {
    let token = this.consumeToken([
      TokenTypes.LEFT_SQUARE_BRACKET,
      TokenTypes.NEGATIVE_CHARACTER_CLASS_START,
    ]);
    const pos = createPosition(token.value.position)!;

    this.isInCharacterClass = true;

    let negative = false;
    if (token.value.raw === '[^') {
      negative = true;
    }

    const body:(RegexParser.CharacterClassBodyItem)[] = [];
    let isInClassRange = false;
    while (!this.ifLookaheadIs(TokenTypes.RIGHT_SQUARE_BRACKET)) {
      const last = body[body.length - 1];
      if (this.ifLookaheadIs(TokenTypes.DASH) && last && last.type !== 'classRange') {
        token = this.consumeToken(TokenTypes.DASH);
        isInClassRange = true;
      } else if (this.ifLookaheadIs([
        TokenTypes.CHARACTER,
        TokenTypes.ANY_CHARACTER,
        TokenTypes.DASH,
      ])) {
        const character = this.Character() as Required<RegexParser.Character>;
        if (isInClassRange) {
          const from = body.pop() as
          Required<Exclude<RegexParser.CharacterClassBodyItem, RegexParser.ClassRange>>;
          const to = character;
          body.push(this.ClassRange(from, to));

          isInClassRange = false;
        } else {
          body.push(character);
        }
      } else {
        const escape = this.CharacterEscape();
        if (isInClassRange) {
          const from = body.pop() as
          Required<Exclude<RegexParser.CharacterClassBodyItem, RegexParser.ClassRange>>;
          const to = escape;
          body.push(this.ClassRange(from, to));

          isInClassRange = false;
        } else {
          body.push(escape);
        }
      }
    }

    this.isInCharacterClass = false;

    token = this.consumeToken(TokenTypes.RIGHT_SQUARE_BRACKET);
    pos.end.line = token.value.position.end.line;
    pos.end.column = token.value.position.end.column;

    return {
      type: 'characterClass',
      negative,
      body,
      raw: this.getText(pos),
      pos,
    };
  }

  private ClassRange(
    from: Required<Exclude<RegexParser.CharacterClassBodyItem, RegexParser.ClassRange>>,
    to: Required<Exclude<RegexParser.CharacterClassBodyItem, RegexParser.ClassRange>>,
  ): RegexParser.ClassRange {
    if ((isUnicodePropertyEscape(to) && to.kind === 'unicodeProperty')
    || (isUnicodePropertyEscape(from) && from.kind === 'unicodeProperty')
    ) {
      throw syntaxError({
        line: from.pos.start.line,
        column: from.pos.start.column,
      }, INVALID_CHARACTER_CLASS_ERROR);
    }

    if (from.char.codePointAt(0)! > to.char.codePointAt(0)!) {
      throw syntaxError({
        line: from.pos.start.line,
        column: from.pos.start.column,
      }, CLASS_RANGE_OUT_OF_ORDER_ERROR);
    }

    const pos = createPosition(from.pos)!;
    pos.end.line = to.pos.end.line;
    pos.end.column = to.pos.end.column;
    return {
      type: 'classRange',
      from,
      to,
      raw: this.getText(pos),
      pos,
    };
  }

  private Group(): RegexParser.Group {
    if (this.ifLookaheadIs(TokenTypes.LEFT_PARENTHESIS)) {
      return this.CapturingGroup();
    } if (this.ifLookaheadIs(TokenTypes.NON_CAPTURING_GROUP_START)) {
      return this.NoneCapturingGroup();
    }
    return this.NamedCaptureGroup();
  }

  private CapturingGroup(): RegexParser.CapturingGroup {
    let token = this.consumeToken(TokenTypes.LEFT_PARENTHESIS);
    const pos = createPosition(token.value.position)!;

    const disjunction = this.Disjunction();

    token = this.consumeToken(TokenTypes.RIGHT_PARENTHESIS);
    pos.end.line = token.value.position.end.line;
    pos.end.column = token.value.position.end.column;
    return {
      type: 'group',
      capturing: true,
      n: this.capturingGroupsCount,
      body: disjunction,
      raw: this.getText(pos),
      pos,
    };
  }

  private NoneCapturingGroup(): RegexParser.NoneCapturingGroup {
    let token = this.consumeToken(TokenTypes.NON_CAPTURING_GROUP_START);
    const pos = createPosition(token.value.position)!;

    const disjunction = this.Disjunction();

    token = this.consumeToken(TokenTypes.RIGHT_PARENTHESIS);
    pos.end.line = token.value.position.end.line;
    pos.end.column = token.value.position.end.column;
    return {
      type: 'group',
      capturing: false,
      body: disjunction,
      raw: this.getText(pos),
      pos,
    };
  }

  private NamedCaptureGroup(): RegexParser.NamedCaptureGroup {
    let token = this.consumeToken(TokenTypes.NAMED_CAPTURING_GROUP_START);
    const pos = createPosition(token.value.position)!;

    token = this.consumeToken(TokenTypes.GROUP_NAME);
    const name = token.value.raw;
    token = this.consumeToken(TokenTypes.RIGHT_ANGLE_BRACKET);

    const disjunction = this.Disjunction();

    token = this.consumeToken(TokenTypes.RIGHT_PARENTHESIS);
    pos.end.line = token.value.position.end.line;
    pos.end.column = token.value.position.end.column;

    return {
      type: 'group',
      name,
      n: this.capturingGroupsCount,
      body: disjunction,
      raw: this.getText(pos),
      pos,
    };
  }

  private BackReference(): RegexParser.BackReference | undefined {
    if (this.ifLookaheadIs(TokenTypes.NUMBER_ESCAPE)) {
      let num = this.lookahead!.value.raw.slice(1);
      for (let i = this.lexer.getCursor() + 1; i < this.lexer.tokens.length; i++) {
        const token = this.lexer.tokens[i];
        if (!(token.type === TokenTypes.CHARACTER && token.value.raw.match(rules.digit))) break;
        num += token.value.raw;
      }
      if (Number(num) <= this.capturingGroupsCount) {
        return this.NumberBackedReference();
      }
    } if (this.ifLookaheadIs({ type: TokenTypes.ESCAPE, raw: '\\k' }) && Object.keys(this.namedGroups).length > 0) {
      return this.NameBackedReference();
    }
  }

  private NameBackedReference(): RegexParser.NameBackedReference {
    let token = this.consumeToken({ type: TokenTypes.ESCAPE, raw: '\\k' });
    const pos = createPosition(token.value.position)!;

    this.consumeToken({ type: TokenTypes.CHARACTER, raw: '<' });

    let name = '';
    let groupNames = Object.keys(this.namedGroups);
    while (!this.ifLookaheadIs({ type: TokenTypes.CHARACTER, raw: '>' })) {
      token = this.consumeToken(TokenTypes.CHARACTER);
      name += token.value.raw;

      // eslint-disable-next-line @typescript-eslint/no-loop-func
      groupNames = groupNames.filter((groupName) => groupName.indexOf(name) === 0);
      if (groupNames.length === 0) {
        throw syntaxError({
          line: pos.start.line,
          column: pos.start.column,
        }, INVALID_NAMED_CAPTURE_REFERENCED_ERROR);
      }
    }

    token = this.consumeToken({ type: TokenTypes.CHARACTER, raw: '>' });
    pos.end.line = token.value.position.end.line;
    pos.end.column = token.value.position.end.column;

    return {
      type: 'backReference',
      kind: 'name',
      name,
      raw: this.getText(pos),
      pos,
    };
  }

  private NumberBackedReference(): RegexParser.NumberBackedReference {
    let token = this.consumeToken(TokenTypes.NUMBER_ESCAPE);
    const pos = createPosition(token.value.position)!;

    let nStr = token.value.raw.slice(-1)!;
    while (
      this.lookahead?.type === TokenTypes.CHARACTER
      && this.lookahead.value.raw.match(rules.digit)
      && Number(`${nStr}${this.lookahead.value.raw}`) <= this.capturingGroupsCount
    ) {
      nStr += this.lookahead.value.raw;
      token = this.consumeToken(TokenTypes.CHARACTER);
    }
    pos.end.line = token.value.position.end.line;
    pos.end.column = token.value.position.end.column;

    return {
      type: 'backReference',
      kind: 'number',
      n: Number(nStr),
      raw: this.getText(pos),
      pos,
    };
  }

  private Repetition(atom: RegexParser.Atom): RegexParser.Repetition {
    const pos = createPosition(atom.pos)!;
    const quantifier = this.Quantifier();
    pos.end.line = quantifier.pos.end.line;
    pos.end.column = quantifier.pos.end.column;
    return {
      type: 'repetition',
      body: atom,
      quantifier,
      raw: this.getText(pos),
      pos,
    };
  }

  private Quantifier(): RegexParser.Quantifier {
    let greedy = false;
    let from = -1;
    let to = -1;
    let kind: 'range' | 'symbol' = 'symbol';
    let token = this.consumeToken([TokenTypes.STAR, TokenTypes.PLUS, TokenTypes.MARK,
      TokenTypes.LEFT_BRACE]);
    const pos = createPosition(token.value.position)!;

    if (token.type === TokenTypes.LEFT_BRACE) {
      kind = 'range';
      let numToken = this.consumeToken(TokenTypes.QUANTIFIER_RANGE_NUMBER);
      from = Number(numToken.value.raw);
      to = Number(numToken.value.raw);
      if (this.ifLookaheadIs(TokenTypes.COMMA)) {
        this.consumeToken(TokenTypes.COMMA);
        to = Infinity;
        if (this.ifLookaheadIs(TokenTypes.QUANTIFIER_RANGE_NUMBER)) {
          numToken = this.consumeToken(TokenTypes.QUANTIFIER_RANGE_NUMBER);
          to = Number(numToken.value.raw);
          if (from > to) {
            throw syntaxError({
              line: pos.start.line,
              column: pos.start.column,
            }, INVALID_QUANTIFIER_NUMBERS_ERROR);
          }
        }
      }
      token = this.consumeToken(TokenTypes.RIGHT_BRACE);
      pos.end.line = token.value.position.end.line;
      pos.end.column = token.value.position.end.column;
    } else if (token.type === TokenTypes.STAR) {
      from = 0;
      to = Infinity;
    } else if (token.type === TokenTypes.PLUS) {
      from = 1;
      to = Infinity;
    } else {
      from = 0;
      to = 1;
    }

    if (this.ifLookaheadIs(TokenTypes.MARK)) {
      token = this.consumeToken(TokenTypes.MARK);
      greedy = true;
      pos.end.line = token.value.position.end.line;
      pos.end.column = token.value.position.end.column;
    }

    return {
      type: 'quantifier',
      kind,
      greedy,
      from,
      to,
      raw: this.getText(pos),
      pos,
    };
  }

  private Flags() {
    const flagMap = new Map([
      ['g', 'global'],
      ['i', 'ignoreCase'],
      ['m', 'multiline'],
      ['s', 'dotAll'],
      ['u', 'unicode'],
      ['y', 'sticky'],
    ]);
    const flagSet = new Set();
    const node: RegexParser.Flags = {
      type: 'flags',
      body: '',
      global: false,
      ignoreCase: false,
      multiline: false,
      dotAll: false,
      unicode: false,
      sticky: false,
      pos: this.lookahead && this.lookahead.value.position,
      raw: '',
    };

    while (this.lexer.hasMoreToken()) {
      const token = this.consumeToken(TokenTypes.FLAG);
      const tokenInfo = token.value;

      const flagFullName = flagMap.get(token.value.raw);
      if (!flagFullName || flagSet.has(tokenInfo.raw)) {
        throw syntaxError({
          line: tokenInfo.position.start.line,
          column: tokenInfo.position.start.column,
        }, INVALID_FLAG_ERROR);
      }

      node.body += token.value.raw;
      node.raw = node.body;
      node.pos!.end.line = tokenInfo.position.end.line;
      node.pos!.end.column = tokenInfo.position.end.column;
      node[flagFullName] = true;
      flagSet.add(token.value.raw);
    }
    return node;
  }

  private ifLookaheadIs(or: TokenInfo | TokenInfo[]) {
    let is = false;
    if (!Array.isArray(or)) {
      or = [or];
    }

    for (let i = 0; i < or.length; i++) {
      const tokenInfo = or[i];
      if (typeof tokenInfo === 'object') {
        is = tokenInfo.type === this.lookahead?.type
        && tokenInfo.raw === this.lookahead?.value.raw;
      } else {
        is = tokenInfo === this.lookahead?.type;
      }

      if (is) return is;
    }
    return is;
  }

  private consumeToken(or: TokenInfo | TokenInfo[]) {
    let type: TokenTypes | undefined;
    let token: Token | undefined;
    if (Array.isArray(or)) {
      const findTokenType = or.find((searchTokenInfo) => {
        if (typeof searchTokenInfo === 'object') {
          return searchTokenInfo.type === this.lookahead?.type
          && searchTokenInfo.raw === this.lookahead.value.raw;
        }
        return searchTokenInfo === this.lookahead?.type;
      });
      if (findTokenType) {
        token = this.lexer.getNextToken();
        type = token!.type;
      }
    } else {
      token = this.lexer.getNextToken();
      type = typeof or === 'object' ? or.type : or;
    }
    if (!token || token.type !== type) {
      if (!this.lookahead) {
        throw new Error('Tokens are consumed!');
      }
      throw syntaxError({
        line: this.lookahead.value.position.start.line,
        column: this.lookahead.value.position.start.column,
      }, INVALID_REGEX_ERROR);
    }

    return token;
  }

  private init(regStr: string) {
    this.text = regStr;
    this.ast = null;
  }

  private getText(pos: Position) {
    const textArr = this.text.split('\n');
    let text = '';
    textArr.forEach((lineText, line) => {
      if (pos.start.line === pos.end.line) {
        text += lineText.slice(pos.start.column, pos.end.column);
      } else if (line === pos.start.line) {
        text += lineText.slice(pos.start.column);
      } else if (line === pos.end.line) {
        text += lineText.slice(0, pos.end.column);
      } else {
        text += lineText;
      }
    });

    return text;
  }

  private setLexerState() {
    const idx = this.text.lastIndexOf('/');
    if (idx === 0) {
      throw syntaxError({
        line: 1,
        column: this.text.length,
      }, MISSING_PATTERN_END_ERROR);
    }
    const flags = this.text.slice(idx + 1);
    if (flags.includes('u')) {
      this.lexer.pushState(States.UNICODE);
    }
  }
}
