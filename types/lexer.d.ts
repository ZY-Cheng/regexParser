declare module 'Lexer' {
  const enum TokenTypes {
    SLASH, // /
    BEGIN_OF_INPUT, // ^
    END_OF_INPUT, // $
    ANY_CHARACTER, // .
    LEFT_SQUARE_BRACKET, // [
    NEGATIVE_CHARACTER_CLASS_START, // [^
    RIGHT_SQUARE_BRACKET, // ]
    ESCAPE,
    OCTAL_ESCAPE,
    CONTROL_ESCAPE, // \c[A-Za-z]
    UNICODE_ESCAPE, // \uhhhh \u{hhhh} \u{hhhhh}
    UNICODE_PROPERTY_ESCAPE, // \p{...}
    ALTERNATION, // |
    STAR, // *
    PLUS, // +
    MARK, // ?
    HEX_ESCAPE, // \xhh
    CHARACTER,
    LEFT_BRACE, // {
    QUANTIFIER_RANGE_NUMBER, // [0-9]
    COMMA, // ,
    RIGHT_BRACE, // }
    QUANTIFIER_RANGE_OPEN, // ,}
    DASH, // -
    LEFT_PARENTHESIS, // (
    NON_CAPTURING_GROUP_START, // (?:
    NAMED_CAPTURING_GROUP_START, // (?<
    GROUP_NAME,
    RIGHT_ANGLE_BRACKET, // >
    LOOKAHEAD_START, // (?=
    NEGATIVE_LOOKAHEAD_START, // (?=!
    LOOKBEHIND_START, // (?<=
    NEGATIVE_LOOKBEHIND_START, // (?<=!
    RIGHT_PARENTHESIS, // )
    FLAG, // [gimsuy]
  }

  interface Token {
    type: TokenTypes;
    value: TokenInfo;
  }

  interface Position {
    start: {
      line: number;
      column: number;
    },
    end: {
      line: number;
      column: number;
    }
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
