import { States } from 'Lexer';
import { Lexer } from '../Lexer';

describe('Lexer', () => {
  // const reg1 = '/😊22\\477\\000\\009\\00\\023\\02\\23a^[axsf]{1e,}(12312)\\ca\\n\\t\\u{e1}$/gus';
  const reg1 = '/😊/gus';
  // const reg1 = '/\\uD83D\\u0000/gus';
  // const reg1 = '/휀/gus';

  test(`${reg1} test`, () => {
    const lexer = new Lexer();

    lexer.init(reg1);
    lexer.pushState(States.UNICODE);
    lexer.scan();
    expect(lexer.tokens).toBeInstanceOf(Array);
    console.info(lexer.tokens, lexer.getStates());
  });
});
