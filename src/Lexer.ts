// https://262.ecma-international.org/7.0/#sec-patterns
import {
  Position, States, Token, TokenInfo, TokenTypes,
} from 'Lexer';
import {
  error, INVALID_FLAG_ERROR, INVALID_GROUP_ERROR, INVALID_UNICODE_ESCAPE_ERROR,
} from './error';
import { rules } from './rules';
import { isHighSurrogate, isLowSurrogate } from './utils';

function createToken(type:TokenTypes, value: TokenInfo): Token {
  return {
    type,
    value,
  };
}

export class Lexer {
  tokens: Token[] = [];

  private text: string;

  private cursor = -1;

  private lexemeBegin = -1;

  private forward = 0;

  private states: States[] = [];

  private get isInPatternBody() {
    return this.states.includes(States.PATTERN);
  }

  private get isInCharacterClass() {
    return this.states.includes(States.CHARACTER_CLASS);
  }

  private get isInNamedCapturingGroup() {
    return this.states.includes(States.NAMED_CAPTURING_GROUP);
  }

  private get isInQuantifierRange() {
    return this.states.includes(States.QUANTIFIER_RANGE);
  }

  private get isUnicodeMode() {
    return this.states.includes(States.UNICODE);
  }

  private get lexeme() {
    return this.text.slice(this.lexemeBegin, this.lexemeBegin + this.forward + 1);
  }

  private get position():Position {
    return {
      start: {
        line: 1,
        column: this.lexemeBegin,
      },
      end: {
        line: 1,
        column: this.lexemeBegin + 1 + this.forward,
      },
    };
  }

  scan(): Token[] {
    while (this.hasMoreText()) {
      this.tokenize();
    }

    return this.tokens;
  }

  tokenize() {
    let lexeme = this.next();

    if (lexeme === '/' && !this.isInCharacterClass) {
      if (!this.popState(States.PATTERN)) {
        this.pushState(States.PATTERN);
      }
      this.match(TokenTypes.SLASH, lexeme);
    } else if (lexeme === '[' && !this.isInCharacterClass) {
      this.states.push(States.CHARACTER_CLASS);

      this.forward += 1;
      const newLexeme = this.next();
      if (newLexeme === '[^') {
        this.match(TokenTypes.NEGATIVE_CHARACTER_CLASS_START, newLexeme);
      } else {
        this.forward -= 1;
        this.match(TokenTypes.LEFT_SQUARE_BRACKET, lexeme);
      }
    } else if (lexeme === ']' && this.isInCharacterClass) {
      this.match(TokenTypes.RIGHT_SQUARE_BRACKET, lexeme);
      this.popState();
    } else if (lexeme === '|' && !this.isInCharacterClass) {
      this.match(TokenTypes.ALTERNATION, lexeme);
    } else if (lexeme === '\\') {
      this.forward += 1;
      let newLexeme = this.next();
      const escapeSpec = newLexeme.slice(-1);
      if (escapeSpec.match(rules.octalDigit)) {
        lexeme = newLexeme;
        this.forward += 2;
        newLexeme = this.next();
        if (newLexeme.match(rules.octal3Digit)) {
          this.match(TokenTypes.OCTAL_ESCAPE, newLexeme);
        } else {
          this.forward -= 1;
          lexeme = this.next();
          if (lexeme.match(rules.octal2Digit)) {
            this.match(TokenTypes.OCTAL_ESCAPE, lexeme);
          } else {
            this.forward -= 1;
            lexeme = this.next();
            this.match(TokenTypes.ESCAPE, lexeme);
          }
        }
      } else if (escapeSpec === 'c') {
        this.forward += 1;
        newLexeme = this.next();
        if (newLexeme.slice(-1).match(rules.letter)) {
          this.match(TokenTypes.CONTROL_ESCAPE, newLexeme);
        } else {
          error({
            line: this.position.start.line,
            column: this.position.start.column + newLexeme.length,
          }, newLexeme, INVALID_UNICODE_ESCAPE_ERROR);
        }
      } else if (escapeSpec === 'x') {
        lexeme = newLexeme;
        this.forward += 2;
        newLexeme = this.next();
        if (newLexeme.match(rules.twoHexDigit)) {
          this.match(TokenTypes.HEX_ESCAPE, newLexeme);
        } else {
          this.forward -= 2;
          this.match(TokenTypes.ESCAPE, lexeme);
        }
      } else if (escapeSpec === 'u') {
        lexeme = newLexeme;
        this.forward += 1;
        newLexeme = this.next();
        if (newLexeme === '\\u{' && this.isUnicodeMode) {
          let unicodeLexeme:string;
          while (this.next().slice(-1) !== '}' && this.hasMoreText()) {
            this.forward += 1;
            unicodeLexeme = this.next();
          }
          if (unicodeLexeme.match(rules.unicodeInUnicodeFlag)) {
            this.match(TokenTypes.UNICODE_ESCAPE, unicodeLexeme);
          } else {
            error({
              line: this.position.start.line,
              column: this.position.start.column + newLexeme.length,
            }, unicodeLexeme, INVALID_UNICODE_ESCAPE_ERROR);
          }
        } else {
          lexeme = newLexeme;
          this.forward += 3;
          newLexeme = this.next();
          if (newLexeme.match(rules.unicode)) {
            if (isHighSurrogate(newLexeme)) {
              lexeme = newLexeme;
              this.forward += 6;
              newLexeme = this.next();
              if (!isLowSurrogate(newLexeme)) {
                this.forward -= 6;
                newLexeme = this.next();
              }
            }
            this.match(TokenTypes.UNICODE_ESCAPE, newLexeme);
          } else {
            this.forward = 1;
            lexeme = this.next();
            this.match(TokenTypes.ESCAPE, lexeme);
          }
        }
      } else if (escapeSpec.toLowerCase() === 'p' && this.isUnicodeMode) {
        while (lexeme.slice(-1) !== '}') {
          this.forward += 1;
          lexeme = this.next();
        }
        this.match(TokenTypes.UNICODE_PROPERTY_ESCAPE, lexeme);
      } else {
        this.match(TokenTypes.ESCAPE, newLexeme);
      }
    } else if (lexeme === '$' && !this.isInCharacterClass) {
      this.match(TokenTypes.END_OF_INPUT, lexeme);
    } else if (lexeme === '^' && !this.isInCharacterClass) {
      this.match(TokenTypes.BEGIN_OF_INPUT, lexeme);
    } else if (lexeme === '.' && !this.isInCharacterClass) {
      this.match(TokenTypes.ANY_CHARACTER, lexeme);
    } else if (lexeme === '*' && !this.isInCharacterClass) {
      this.match(TokenTypes.STAR, lexeme);
    } else if (lexeme === '+' && !this.isInCharacterClass) {
      this.match(TokenTypes.PLUS, lexeme);
    } else if (lexeme === '?' && !this.isInCharacterClass) {
      this.match(TokenTypes.MARK, lexeme);
    } else if (lexeme === '{' && !this.isInCharacterClass) {
      let braceStr: string;
      while (this.next().slice(-1) !== '}' && this.hasMoreText()) {
        this.forward += 1;
        braceStr = this.next();
      }
      this.forward = 0;
      if (braceStr.match(rules.quantifierRange)) {
        this.pushState(States.QUANTIFIER_RANGE);
        this.match(TokenTypes.LEFT_BRACE, lexeme);
      } else {
        this.match(TokenTypes.CHARACTER, lexeme);
      }
    } else if (lexeme.match(rules.digit) && this.isInQuantifierRange) {
      this.forward += 1;
      while (!this.next().includes(',') && !this.next().includes('}') && this.hasMoreText()) {
        lexeme = this.next();
        this.forward += 1;
      }

      this.forward -= 1;
      this.match(TokenTypes.QUANTIFIER_RANGE_NUMBER, lexeme);
    } else if (lexeme === ',' && this.isInQuantifierRange) {
      this.forward += 1;
      const newLexeme = this.next();
      if (newLexeme === ',}') {
        this.match(TokenTypes.QUANTIFIER_RANGE_OPEN, newLexeme);
        this.popState();
      } else {
        this.forward -= 1;
        this.match(TokenTypes.COMMA, lexeme);
      }
    } else if (lexeme === '}' && this.isInQuantifierRange) {
      this.match(TokenTypes.RIGHT_BRACE, lexeme);
      this.popState();
    } else if (lexeme === '(' && !this.isInCharacterClass) {
      this.forward += 1;
      let newLexeme = this.next();

      if (newLexeme === '(?') {
        lexeme = newLexeme;
        this.forward += 1;
        newLexeme = this.next();
        if (newLexeme === '(?:') {
          this.match(TokenTypes.NON_CAPTURING_GROUP_START, newLexeme);
        } else if (newLexeme === '(?<') {
          lexeme = newLexeme;
          this.forward += 1;
          newLexeme = this.next();
          if (newLexeme === '(?<=') {
            lexeme = newLexeme;
            this.forward += 1;
            newLexeme = this.next();
            if (newLexeme === '(?<=!') {
              this.match(TokenTypes.NEGATIVE_LOOKBEHIND_START, newLexeme);
            } else {
              this.forward -= 1;
              this.match(TokenTypes.LOOKBEHIND_START, lexeme);
            }
          } else {
            this.forward -= 1;
            this.pushState(States.NAMED_CAPTURING_GROUP);
            this.match(TokenTypes.NAMED_CAPTURING_GROUP_START, lexeme);
          }
        } else if (newLexeme === '(?=') {
          lexeme = newLexeme;
          this.forward += 1;
          newLexeme = this.next();
          if (newLexeme === '(?=!') {
            this.match(TokenTypes.NEGATIVE_LOOKAHEAD_START, newLexeme);
          } else {
            this.forward -= 1;
            this.match(TokenTypes.LOOKAHEAD_START, lexeme);
          }
        } else {
          error({
            line: this.position.start.line,
            column: this.position.start.column + lexeme.length + 1,
          }, lexeme, INVALID_GROUP_ERROR);
        }
      } else {
        this.forward -= 1;
        this.match(TokenTypes.LEFT_PARENTHESIS, lexeme);
      }
    } else if (lexeme !== '>' && this.isInNamedCapturingGroup) {
      // TODO: Identifier logic
      while (this.next().slice(-1) !== '>' && this.hasMoreText()) {
        lexeme = this.next();
        this.forward += 1;
      }
      this.forward -= 1;
      this.match(TokenTypes.GROUP_NAME, lexeme);
    } else if (lexeme === '>' && this.isInNamedCapturingGroup) {
      this.match(TokenTypes.RIGHT_ANGLE_BRACKET, lexeme);
      this.popState();
    } else if (lexeme === ')' && !this.isInCharacterClass) {
      this.match(TokenTypes.RIGHT_PARENTHESIS, lexeme);
    } else if (lexeme === '-' && this.isInCharacterClass) {
      this.match(TokenTypes.DASH, lexeme);
    } else if (!this.isInPatternBody) {
      if (lexeme.match(rules.flag)) {
        this.match(TokenTypes.FLAG, lexeme);
      } else {
        error({
          line: this.position.start.line,
          column: this.position.start.column + 1,
        }, lexeme, INVALID_FLAG_ERROR);
      }
    } else {
      if (isHighSurrogate(lexeme)) {
        this.forward += 1;
        lexeme = this.next();
      }
      this.match(TokenTypes.CHARACTER, lexeme);
    }
  }

  hasMoreToken(): boolean {
    return this.cursor < this.tokens.length - 1;
  }

  getNextToken(isConsume = true) {
    if (isConsume) {
      this.cursor += 1;
      return this.tokens[this.cursor];
    }
    return this.tokens[this.cursor + 1];
  }

  init(text: string) {
    this.text = text;
    this.cursor = -1;
    this.lexemeBegin = -1;
    this.forward = 0;
    this.tokens = [];
    this.states = [];
  }

  pushState(state: States) {
    return this.states.push(state);
  }

  popState(state?: States): States | undefined {
    if ((state && state === this.states.slice(-1)[0]) || !state) {
      return this.states.pop();
    }
    return undefined;
  }

  getStates() {
    return this.states;
  }

  private next() {
    const lexemeBegin = this.lexemeBegin + 1;

    return this.text.slice(lexemeBegin, lexemeBegin + this.forward + 1);
  }

  private match(type:TokenTypes, lexeme: string, info: Omit<TokenInfo, 'position' | 'raw'> = {}) {
    const token = createToken(type, {
      position: this.position,
      raw: lexeme,
      ...info,
    });
    this.tokens.push(token);
    this.lexemeBegin += (this.forward + 1);
    this.forward = 0;
  }

  private hasMoreText() {
    return this.lexemeBegin < this.text.length - 1;
  }
}
