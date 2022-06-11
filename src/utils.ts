export function isHighSurrogate(unicodeStr: string) {
  let num;
  if (unicodeStr.length === 1) {
    num = unicodeStr.charCodeAt(0);
  } else {
    const hex = unicodeStr.slice(-4);
    num = parseInt(hex, 16);
  }
  return num >= 0xD800 && num <= 0xDBFF;
}

export function isLowSurrogate(unicodeStr: string) {
  let num;
  if (unicodeStr.length === 1) {
    num = unicodeStr.charCodeAt(0);
  } else {
    const hex = unicodeStr.slice(-4);
    num = parseInt(hex, 16);
  }
  return num >= 0xDC00 && num <= 0xDFFF;
}
