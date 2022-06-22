import { BINARY_NAME_ALIAS_TO_NAME, BINARY_NAME_TO_ALIAS } from './binaryName';
import { GC_VALUE_ALIAS_TO_VALUE, GC_VALUE_TO_ALIAS } from './generalCategory';
import { NON_BINARY_NAME_ALIAS_TO_NAME, NON_BINARY_NAME_TO_ALIAS } from './non-binaryName';
import { SC_VALUE_ALIAS_TO_VALUE, SC_VALUE_TO_ALIAS } from './script';

export type UnicodePropertyInfo = {
  binary: boolean;
  nameAlias?: string | string[];
  valueAlias?: string | string[];
  canonicalName: string;
  canonicalValue?: string;
};

export function getUnicodePropertyInfoFromName(
  s: string,
  binary = false,
): UnicodePropertyInfo | undefined {
  const binaryName = binary ? BINARY_NAME_ALIAS_TO_NAME[s] : undefined;
  const nonBinaryName = NON_BINARY_NAME_ALIAS_TO_NAME[s];
  const name = binaryName ?? nonBinaryName;
  if (name !== undefined) {
    return {
      binary: binaryName !== undefined,
      nameAlias: s,
      canonicalName: name,
    };
  }
  const binaryAlias = binary ? BINARY_NAME_TO_ALIAS[s] : undefined;
  const nonBinaryAlias = NON_BINARY_NAME_TO_ALIAS[s];
  const alias = binaryAlias ?? nonBinaryAlias;
  if (alias !== undefined) {
    return {
      binary: binaryAlias !== undefined,
      valueAlias: alias,
      canonicalName: s,
    };
  }
}
export function getUnicodePropertyInfoFromValue(
  s: string,
  propertyName: 'General_Category' | 'Script' | 'Script_Extensions' | string = 'General_Category',
): UnicodePropertyInfo | undefined {
  const value = propertyName === 'General_Category' ? GC_VALUE_ALIAS_TO_VALUE[s] : SC_VALUE_ALIAS_TO_VALUE[s];
  if (value !== undefined) {
    return {
      binary: false,
      nameAlias: NON_BINARY_NAME_TO_ALIAS[propertyName],
      valueAlias: s,
      canonicalName: propertyName,
      canonicalValue: value,
    };
  }

  const valueAlias = propertyName === 'General_Category' ? GC_VALUE_TO_ALIAS[s] : SC_VALUE_TO_ALIAS[s];
  if (valueAlias !== undefined) {
    return {
      binary: false,
      nameAlias: NON_BINARY_NAME_TO_ALIAS[propertyName],
      valueAlias,
      canonicalName: propertyName,
      canonicalValue: s,
    };
  }
}
export function getUnicodePropertyInfo(s: string):UnicodePropertyInfo | undefined {
  return getUnicodePropertyInfoFromValue(s) || getUnicodePropertyInfoFromName(s, true);
}
