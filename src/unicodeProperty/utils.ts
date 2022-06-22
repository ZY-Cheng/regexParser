export function invert(o: Record<string, string | string[]>): Record<string, string> {
  const temp = {};
  Object.keys(o).forEach((key) => {
    const val = o[key];
    if (!val) return;
    if (Array.isArray(val)) {
      val.forEach((innerVal) => {
        temp[innerVal] = key;
      });
    } else {
      temp[val] = key;
    }
  });
  return temp;
}
