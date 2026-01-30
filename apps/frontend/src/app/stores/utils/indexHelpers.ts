export const addToIndex = (
  idx: Record<string, string[]>,
  key: string,
  id: string,
): Record<string, string[]> => {
  const arr = idx[key] ?? [];
  if (arr.includes(id)) return idx;
  return { ...idx, [key]: [...arr, id] };
};

export const removeFromIndex = (
  idx: Record<string, string[]>,
  key: string,
  id: string,
): Record<string, string[]> => {
  const arr = idx[key] ?? [];
  if (!arr.length) return idx;
  return { ...idx, [key]: arr.filter((x) => x !== id) };
};
