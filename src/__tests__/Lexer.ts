import { States } from 'Lexer';
import { Lexer } from '../Lexer';

describe('Lexer', () => {
  const reg1 = '/\\x22\\477\\000\\009\\00\\023\\02\\23a^[axsf]{1e,}(12312)\\ca\\n\\t\\u{e1}$/gus';

  test(`${reg1} test`, () => {
    const lexer = new Lexer();

    lexer.pushState(States.UNICODE);
    lexer.scan(reg1);
    expect(lexer.tokens).toBeInstanceOf(Array);
    console.info(lexer.tokens, lexer.getStates());
  });
});
