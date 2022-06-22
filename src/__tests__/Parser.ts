import * as fs from 'fs';
import * as path from 'path';
import {
  Anchor,
  Assertion,
  BackReference,
  Character,
  CharacterClass,
  CharacterEscape,
  ClassRange,
  Escape,
  Group,
  Lookaround,
  NameBackedReference,
  NamedCaptureGroup,
  NoneCapturingGroup,
  Repetition,
  UnicodePropertyEscape,
  WordBoundary,
} from 'RegexParser';
import {
  CLASS_RANGE_OUT_OF_ORDER_ERROR,
  DUPLICATE_CAPTURE_GROUP_NAME_ERROR,
  INVALID_FLAG_ERROR,
  INVALID_NAMED_CAPTURE_REFERENCED_ERROR,
  INVALID_QUANTIFIER_ERROR,
  INVALID_UNICODE_PROPERTY_NAME_ERROR,
  MISSING_PATTERN_END_ERROR,
} from '../error';
import { Parser } from '../Parser';

function outputJSON(tokens: any, ast: any) {
  fs.writeFile(
    path.resolve(__dirname, '../../out/lexer.json'),
    JSON.stringify(tokens, null, 2),
    'utf-8',
    (err) => {},
  );
  fs.writeFile(
    path.resolve(__dirname, '../../out/parser.json'),
    JSON.stringify(ast, null, 2),
    'utf-8',
    (err) => {},
  );
}

const sample = {
  invalid: {
    notEnclosePattern: '/',
    invalidFlag: '/a/j',
    namedBackReferenceBeforeGroup: '/\\k<ax>aaaa(?<ab>sad)/',
    unicodeProperty: '/\\p{a}/u',
    nothingBeforeQuantifier: '/{1,}/',
    anchorBeforeQuantifier: '/^{1,}/',
    lookaroundBeforeQuantifier: '/(?<=a){1,}/',
    invertCharacterClassRangeOrder: '/[z-a]/',

  },
  valid: {
    emptyPattern: '//',
    emptyGroup: '/()/',
    emptyAlternative: '/|/',
    emptyAlternativeOnLeft: '/|a/',
    emptyAlternativeOnRight: '/a|/',
    emptyCharacterClass: '/[^]/',
    numberBackReferenceBeforeGroup: '/\\2()()/',
    numberEscapeGreaterThanGroupCountBeforeGroup: '/\\33()()(?:a)/',
    namedBackReferenceBeforeGroup: '/\\k<ab>a(?<ab>sad)/',
    twoDigitOctalFollowByNumberChar: '/\\379/',
    threeDigitOctalFollowByNumberChar: '/\\377\\9/',
    octalBeyond377FollowByNumberChar: '/\\4009/',
    unicodeInCharacterClass: '/😊[😊]/',
    escapeUnicodeInCharacterClass: '/\\😊/',
    unicodeEscapeWithSurrogatePair: '/\\uD83D\\uDE0A\\ua/',
    unicodeEscapeInUnicodeMode: '/\\u{1f60a}[\\u{1f60a}]/u',
    unicodeProperty: '/\\p{L}\\P{ASCII}\\p{gc=L}\\p{General_Category=Letter}/u',
    repetition: '/a{1,}a*?a+a?a{1,12}a{1}/',
    notQuantifier: '/a{,1}/',
    wordBoundary: '/a\\b\\B/',
    hexEscape: '/\\x31[\\x31]\\xz/',
    characterClassRange: '/[-a-zA-Z\\x30-\\x39\\u1111-\\u3333]/',
    specialChar: '/^a.$[.^$]/',
    lookaround: '/(?<=b)a(?=c)(?<=!b)a(?=!c)/',
    controlEscape: '/\\caa\\cz/',
    specialEscape: '/\\n[\\n]/',
  },
};

describe('valid regex', () => {
  const { valid } = sample;

  describe('specialEscape', () => {
    const reg = valid.specialEscape;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      outputJSON(tokens, ast);
      expect((terms[0] as CharacterEscape).kind).toBe('special');
      expect((terms[0] as CharacterEscape).char).toBe('\n');
      const characterClass = terms[1] as CharacterClass;
      expect((characterClass.body[0] as CharacterEscape).kind).toBe('special');
      expect((characterClass.body[0] as CharacterEscape).char).toBe('\n');
    });
  });

  describe('controlEscape', () => {
    const reg = valid.controlEscape;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      outputJSON(tokens, ast);
      expect((terms[0] as CharacterEscape).kind).toBe('control');
      // expect((terms[0] as CharacterEscape).char).toBe('\u0001');
      expect((terms[1] as Character).char).toBe('a');
      expect((terms[2] as CharacterEscape).kind).toBe('control');
      expect((terms[2] as CharacterEscape).char).toBe('\u001a');
    });
  });

  describe('lookaround', () => {
    const reg = valid.lookaround;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect((terms[0] as Lookaround).kind).toBe('lookbehind');
      expect((terms[0] as Lookaround).negative).toBe(false);
      expect((terms[1] as Character).char).toBe('a');
      expect((terms[2] as Lookaround).kind).toBe('lookahead');
      expect((terms[2] as Lookaround).negative).toBe(false);
      expect((terms[3] as Lookaround).kind).toBe('lookbehind');
      expect((terms[3] as Lookaround).negative).toBe(true);
      expect((terms[4] as Character).char).toBe('a');
      expect((terms[5] as Lookaround).kind).toBe('lookahead');
      expect((terms[5] as Lookaround).negative).toBe(true);
      // outputJSON(tokens, ast);
    });
  });

  describe('specialChar', () => {
    const reg = valid.specialChar;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect((terms[0] as Anchor).kind).toBe('anchor');
      expect((terms[1] as Character).kind).toBe('literal');
      expect((terms[2] as Character).kind).toBe('special');
      expect((terms[3] as Anchor).kind).toBe('anchor');
      const characterClass = terms[4] as CharacterClass;
      expect((characterClass.body[0] as Character).char).toBe('.');
      expect((characterClass.body[1] as Character).char).toBe('^');
      expect((characterClass.body[2] as Character).char).toBe('$');
      // outputJSON(tokens, ast);
    });
  });

  describe('characterClassRange', () => {
    const reg = valid.characterClassRange;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      const characterClass = terms[0] as CharacterClass;
      expect(characterClass.type).toBe('characterClass');
      expect((characterClass.body[0] as Character).kind).toBe('literal');
      expect((characterClass.body[0] as Character).char).toBe('-');
      expect((characterClass.body[1] as ClassRange).type).toBe('classRange');
      expect((characterClass.body[1] as ClassRange).from.char).toBe('a');
      expect((characterClass.body[1] as ClassRange).to.char).toBe('z');
      expect((characterClass.body[2] as ClassRange).type).toBe('classRange');
      expect((characterClass.body[2] as ClassRange).from.char).toBe('A');
      expect((characterClass.body[2] as ClassRange).to.char).toBe('Z');
      expect((characterClass.body[3] as ClassRange).type).toBe('classRange');
      expect((characterClass.body[3] as ClassRange).from.char).toBe('0');
      expect((characterClass.body[3] as ClassRange).to.char).toBe('9');
      expect((characterClass.body[4] as ClassRange).from.type).toBe('escape');
      expect((characterClass.body[4] as ClassRange).to.type).toBe('escape');
      // outputJSON(tokens, ast);
    });
  });

  describe('hexEscape', () => {
    const reg = valid.hexEscape;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('escape');
      expect((terms[0] as CharacterEscape).kind).toBe('hex');
      expect((terms[0] as CharacterEscape).char).toBe('1');
      const characterClass = terms[1] as CharacterClass;
      expect(characterClass.type).toBe('characterClass');
      expect((characterClass.body[0] as CharacterEscape).kind).toBe('hex');
      expect((characterClass.body[0] as CharacterEscape).char).toBe('1');
      expect((terms[2] as CharacterEscape).kind).toBe('literal');
      expect((terms[2] as CharacterEscape).char).toBe('x');
      expect((terms[3] as Character).char).toBe('z');
      // outputJSON(tokens, ast);
    });
  });

  describe('wordBoundary', () => {
    const reg = valid.wordBoundary;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('character');
      expect(terms[1].type).toBe('assertion');
      expect((terms[1] as WordBoundary).kind).toBe('wordBoundary');
      expect((terms[1] as WordBoundary).negative).toBe(false);
      expect(terms[2].type).toBe('assertion');
      expect((terms[2] as WordBoundary).kind).toBe('wordBoundary');
      expect((terms[2] as WordBoundary).negative).toBe(true);
      // outputJSON(tokens, ast);
    });
  });

  describe('notQuantifier', () => {
    const reg = valid.notQuantifier;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('character');
      expect(terms[1].type).toBe('character');
      // outputJSON(tokens, ast);
    });
  });

  describe('repetition', () => {
    const reg = valid.repetition;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('repetition');
      expect((terms[0] as Repetition).quantifier.from).toBe(1);
      expect((terms[0] as Repetition).quantifier.to).toBe(Infinity);
      expect(terms[1].type).toBe('repetition');
      expect((terms[1] as Repetition).quantifier.from).toBe(0);
      expect((terms[1] as Repetition).quantifier.to).toBe(Infinity);
      expect((terms[1] as Repetition).quantifier.greedy).toBe(true);
      expect(terms[2].type).toBe('repetition');
      expect((terms[2] as Repetition).quantifier.from).toBe(1);
      expect((terms[2] as Repetition).quantifier.to).toBe(Infinity);
      expect(terms[3].type).toBe('repetition');
      expect((terms[3] as Repetition).quantifier.from).toBe(0);
      expect((terms[3] as Repetition).quantifier.to).toBe(1);
      expect(terms[4].type).toBe('repetition');
      expect((terms[4] as Repetition).quantifier.from).toBe(1);
      expect((terms[4] as Repetition).quantifier.to).toBe(12);
      expect(terms[5].type).toBe('repetition');
      expect((terms[5] as Repetition).quantifier.from).toBe(1);
      expect((terms[5] as Repetition).quantifier.to).toBe(1);
      // outputJSON(tokens, ast);
    });
  });

  describe('unicodeProperty', () => {
    const reg = valid.unicodeProperty;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('escape');
      expect((terms[0] as UnicodePropertyEscape).kind).toBe('unicodeProperty');
      expect((terms[1] as UnicodePropertyEscape).kind).toBe('unicodeProperty');
      expect((terms[1] as UnicodePropertyEscape).negative).toBe(false);
      // outputJSON(tokens, ast);
    });
  });

  describe('emptyAlternative', () => {
    const reg = valid.emptyAlternative;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      expect(ast!.pattern.body).toMatchObject([null, null]);
      // outputJSON(tokens, ast);
    });
  });

  describe('emptyAlternativeOnLeft', () => {
    const reg = valid.emptyAlternativeOnLeft;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      expect(ast!.pattern.body[0]).toBe(null);
      expect(ast!.pattern.body[1]?.body[0].type).toBe('character');
      // outputJSON(tokens, ast);
    });
  });

  describe('emptyAlternativeOnRight', () => {
    const reg = valid.emptyAlternativeOnRight;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      expect(ast!.pattern.body[0]?.body[0].type).toBe('character');
      expect(ast!.pattern.body[1]).toBe(null);
      // outputJSON(tokens, ast);
    });
  });

  describe('emptyCharacterClass', () => {
    const reg = valid.emptyCharacterClass;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      const characterClass = terms[0] as CharacterClass;
      expect(characterClass.negative).toBe(true);
      expect(characterClass.body.length).toBe(0);
      // outputJSON(tokens, ast);
    });
  });

  describe('unicodeEscapeInUnicodeMode', () => {
    const reg = valid.unicodeEscapeInUnicodeMode;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      const characterClass = terms[1] as CharacterClass;
      expect(terms[0].type).toBe('escape');
      expect((terms[0] as CharacterEscape).kind).toBe('unicode');
      expect((terms[0] as CharacterEscape).char).toBe('😊');
      expect((characterClass.body[0] as CharacterEscape).kind).toBe('unicode');
      expect((characterClass.body[0] as CharacterEscape).char).toBe('😊');
      // outputJSON(tokens, ast);
    });
  });

  describe('unicodeEscapeWithSurrogatePair', () => {
    const reg = valid.unicodeEscapeWithSurrogatePair;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      // outputJSON(tokens, ast);
      expect(terms[0].type).toBe('escape');
      expect((terms[0] as CharacterEscape).kind).toBe('unicode');
      expect((terms[0] as CharacterEscape).char).toBe('\uD83D');
      expect((terms[1] as CharacterEscape).kind).toBe('unicode');
      expect((terms[1] as CharacterEscape).char).toBe('\uDE0A');
      expect((terms[2] as CharacterEscape).kind).toBe('literal');
      expect((terms[2] as CharacterEscape).char).toBe('u');
      expect((terms[3] as Character).char).toBe('a');
    });
  });

  describe('escapeUnicodeInCharacterClass', () => {
    const reg = valid.escapeUnicodeInCharacterClass;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('escape');
      expect(terms[0].raw).toBe('\\😊');
      expect((terms[0] as CharacterEscape).kind).toBe('literal');
      expect((terms[0] as CharacterEscape).char).toBe('😊');
      // outputJSON(tokens, ast);
    });
  });

  describe('unicodeInCharacterClass', () => {
    const reg = valid.unicodeInCharacterClass;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('character');
      expect(terms[0].raw).toBe('😊');
      expect(terms[1].type).toBe('characterClass');
      const characterClass = terms[1] as CharacterClass;
      expect(characterClass.body.length).toBe(2);
      // outputJSON(tokens, ast);
    });
  });

  describe('namedBackReferenceBeforeGroup', () => {
    const reg = valid.namedBackReferenceBeforeGroup;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('backReference');
      expect((terms[0] as NameBackedReference).kind).toBe('name');
      expect((terms[0] as NameBackedReference).name).toBe('ab');
      expect(terms[1].type).toBe('character');
      expect(terms[1].raw).toBe('a');
      expect(terms[2].type).toBe('group');
      expect((terms[2] as NamedCaptureGroup).name).toBe('ab');
      // outputJSON(tokens, ast);
    });
  });

  describe('octalBeyond377FollowByNumberChar', () => {
    const reg = valid.octalBeyond377FollowByNumberChar;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('escape');
      expect(terms[0].raw).toBe('\\40');
      expect(terms[1].type).toBe('character');
      expect(terms[1].raw).toBe('0');
      // outputJSON(tokens, ast);
    });
  });

  describe('threeDigitOctalFollowByNumberChar', () => {
    const reg = valid.threeDigitOctalFollowByNumberChar;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('escape');
      expect(terms[0].raw).toBe('\\377');
      expect(terms[1].type).toBe('escape');
      expect((terms[1] as CharacterEscape).kind).toBe('literal');
      expect((terms[1] as CharacterEscape).char).toBe('9');
      // outputJSON(tokens, ast);
    });
  });

  describe('twoDigitOctalFollowByNumberChar', () => {
    const reg = valid.twoDigitOctalFollowByNumberChar;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      const terms = alternative!.body;
      expect(terms[0].type).toBe('escape');
      expect(terms[0].raw).toBe('\\37');
      expect(terms[1].type).toBe('character');
      expect(terms[1].raw).toBe('9');
      // outputJSON(tokens, ast);
    });
  });

  describe('numberEscapeGreaterThanGroupCountBeforeGroup', () => {
    const reg = valid.numberEscapeGreaterThanGroupCountBeforeGroup;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0];
      expect(alternative!.body[0].type).toBe('escape');
      expect((alternative!.body[3] as NoneCapturingGroup).type).toBe('group');
      expect((alternative!.body[3] as NoneCapturingGroup).capturing).toBe(false);
      // outputJSON(tokens, ast);
    });
  });

  describe('emptyPattern', () => {
    const reg = valid.emptyPattern;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      expect(ast!.flags.pos).toBeUndefined();
      expect(ast!.pattern.body).toMatchObject([null]);
      // outputJSON(tokens, ast);
    });
  });

  describe('emptyGroup', () => {
    const reg = valid.emptyGroup;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const group = ast!.pattern.body[0]!.body[0] as Group;
      expect(group.type).toBe('group');
      expect(group.body.body).toMatchObject([null]);
      // outputJSON(tokens, ast);
    });
  });

  describe('numberBackReferenceBeforeGroup', () => {
    const reg = valid.numberBackReferenceBeforeGroup;

    test(`${reg}`, () => {
      const parser = new Parser();
      parser.parse(reg);
      const { ast } = parser;
      const { tokens } = parser.lexer;
      const alternative = ast!.pattern.body[0]!;
      expect(alternative.body[0].type).toBe('backReference');
      // outputJSON(tokens, ast);
    });
  });
});

describe('invalid regex', () => {
  const { invalid } = sample;

  describe('notEnclosePattern', () => {
    const reg = invalid.notEnclosePattern;

    test(`${reg}`, () => {
      const parser = new Parser();
      expect(() => parser.parse(reg)).toThrow(MISSING_PATTERN_END_ERROR);
    });
  });

  describe('invalidFlag', () => {
    const reg = invalid.invalidFlag;

    test(`${reg}`, () => {
      const parser = new Parser();
      expect(() => parser.parse(reg)).toThrow(INVALID_FLAG_ERROR);
    });
  });

  describe('namedBackReferenceBeforeGroup', () => {
    const reg = invalid.namedBackReferenceBeforeGroup;

    test(`${reg}`, () => {
      const parser = new Parser();
      expect(() => parser.parse(reg)).toThrow(INVALID_NAMED_CAPTURE_REFERENCED_ERROR);
    });
  });

  describe('unicodeProperty', () => {
    const reg = invalid.unicodeProperty;

    test(`${reg}`, () => {
      const parser = new Parser();
      expect(() => parser.parse(reg)).toThrow(INVALID_UNICODE_PROPERTY_NAME_ERROR);
    });
  });

  describe('nothingBeforeQuantifier', () => {
    const reg = invalid.nothingBeforeQuantifier;

    test(`${reg}`, () => {
      const parser = new Parser();
      expect(() => parser.parse(reg)).toThrow(INVALID_QUANTIFIER_ERROR);
    });
  });

  describe('anchorBeforeQuantifier', () => {
    const reg = invalid.anchorBeforeQuantifier;

    test(`${reg}`, () => {
      const parser = new Parser();
      expect(() => parser.parse(reg)).toThrow(INVALID_QUANTIFIER_ERROR);
    });
  });

  describe('lookaroundBeforeQuantifier', () => {
    const reg = invalid.lookaroundBeforeQuantifier;

    test(`${reg}`, () => {
      const parser = new Parser();
      expect(() => parser.parse(reg)).toThrow(INVALID_QUANTIFIER_ERROR);
    });
  });

  describe('invertCharacterClassRangeOrder', () => {
    const reg = invalid.invertCharacterClassRangeOrder;

    test(`${reg}`, () => {
      const parser = new Parser();
      expect(() => parser.parse(reg)).toThrow(CLASS_RANGE_OUT_OF_ORDER_ERROR);
    });
  });
});
