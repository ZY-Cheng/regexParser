/* eslint-disable max-classes-per-file */
interface Position {
  line: number;
  column: number;
}

class LexicalError extends Error {
  position: Position;
}

class SyntaxError extends Error {
  position: Position;
}

export const MISSING_PATTERN_END_ERROR = 'missing /: ';
export const INVALID_REGEX_ERROR = 'Invalid regular expression: ';
export const INVALID_GROUP_ERROR = 'Invalid group: ';
export const INVALID_FLAG_ERROR = 'Invalid flag: ';
export const INVALID_UNICODE_ESCAPE_ERROR = 'Invalid Unicode escape: ';
export const INVALID_QUANTIFIER_NUMBERS_ERROR = 'numbers out of order in {} quantifier: ';
export const INVALID_UNICODE_PROPERTY_NAME_ERROR = 'Invalid property name: ';
export const CLASS_RANGE_OUT_OF_ORDER_ERROR = 'Range out of order in character class: ';
export const INVALID_CHARACTER_CLASS_ERROR = 'Invalid character class: ';
export const INVALID_UNICODE_PROPERTY_VALUE_ERROR = 'Invalid property value: ';
export const INVALID_NAMED_CAPTURE_REFERENCED_ERROR = 'Invalid named capture referenced: ';
export const DUPLICATE_CAPTURE_GROUP_NAME_ERROR = 'Duplicate capture group name: ';
export const INVALID_QUANTIFIER_ERROR = 'Invalid quantifier: ';

export function error(position: Position, token: string, prefix = '') {
  const err = new LexicalError(`${prefix}Unexpected token: <${token}> at ${position.line}:${position.column}`);
  err.position = position;
  err.name = 'LexicalError';
  return err;
}

export function syntaxError(position: Position, prefix = '') {
  const err = new SyntaxError(`${prefix}Unexpected syntax at ${position.line}:${position.column}`);
  err.position = position;
  err.name = 'SyntaxError';
  return err;
}
