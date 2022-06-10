interface Position {
  line: number;
  column: number;
}

class SyntaxError extends Error {
  position: Position;
}

export const MISSING_END_ERROR = 'missing /: ';
export const INVALID_REGEX_ERROR = 'Invalid regular expression: ';
export const INVALID_GROUP_ERROR = 'Invalid group: ';
export const INVALID_FLAG_ERROR = 'Invalid flag: ';
export const INVALID_UNICODE_ESCAPE_ERROR = 'Invalid Unicode escape: ';

export function error(position: Position, token: string, prefix = '') {
  const err = new SyntaxError(`${prefix}Unexpected token: <${token}> at ${position.line}:${position.column}`);
  err.position = position;
  err.name = 'syntaxError';
  throw err;
}
