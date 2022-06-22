import { invert } from './utils';

export const NON_BINARY_NAME_TO_ALIAS: Record<string, string> = {
  General_Category: 'gc',
  Script: 'sc',
  Script_Extensions: 'scx',
};

export const NON_BINARY_NAME_ALIAS_TO_NAME = invert(NON_BINARY_NAME_TO_ALIAS);
