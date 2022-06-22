declare module 'Lexer' {
  const enum TokenTypes {
    /** @constant / */
    SLASH,
    /** @constant ^ */
    BEGIN_OF_INPUT,
    /** @constant \$ */
    END_OF_INPUT,
    /** @constant . */
    ANY_CHARACTER,
    /** @constant [ */
    LEFT_SQUARE_BRACKET,
    /** @constant [^ */
    NEGATIVE_CHARACTER_CLASS_START,
    /** @constant ] */
    RIGHT_SQUARE_BRACKET,
    /** @constant \\. */
    ESCAPE,
    /** @constant \\[1-9] */
    NUMBER_ESCAPE,
    /** @constant \c[A-Za-z] */
    CONTROL_ESCAPE,
    /** @constant \uhhhh \u{hhhh} \u{hhhhh} */
    UNICODE_ESCAPE,
    /** @constant \p{...} */
    UNICODE_PROPERTY_ESCAPE,
    /** @constant | */
    ALTERNATION,
    /** @constant * */
    STAR,
    /** @constant + */
    PLUS,
    /** @constant ? */
    MARK,
    /** @constant \xhh */
    HEX_ESCAPE,
    CHARACTER,
    /** @constant \{ */
    LEFT_BRACE,
    /** @constant */
    QUANTIFIER_RANGE_NUMBER,
    /** @constant , */
    COMMA,
    /** @constant } */
    RIGHT_BRACE,
    /** @constant - */
    DASH,
    /** @constant ( */
    LEFT_PARENTHESIS,
    /** @constant (?: */
    NON_CAPTURING_GROUP_START,
    /** @constant (?< */
    NAMED_CAPTURING_GROUP_START,
    /** @constant */
    GROUP_NAME,
    /** @constant < */
    LEFT_ANGLE_BRACKET,
    /** @constant > */
    RIGHT_ANGLE_BRACKET,
    /** @constant (?= */
    LOOKAHEAD_START,
    /** @constant (?=! */
    NEGATIVE_LOOKAHEAD_START,
    /** @constant (?<= */
    LOOKBEHIND_START,
    /** @constant (?<=! */
    NEGATIVE_LOOKBEHIND_START,
    /** @constant ) */
    RIGHT_PARENTHESIS,
    /** @constant [gimsuy] */
    FLAG,
  }

  interface Token {
    type: TokenTypes;
    value: TokenInfo;
  }

  interface Position {
    start: {
      line: number;
      column: number;
    };
    end: {
      line: number;
      column: number;
    };
  }

  interface TokenInfo {
    position: Position;
    raw: string;
  }

  const enum States {
    UNICODE,
    PATTERN,
    CHARACTER_CLASS,
    QUANTIFIER_RANGE,
    NAMED_CAPTURING_GROUP,
  }

}
