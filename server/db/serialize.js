export function withId(doc) {
  if (!doc) return doc;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest };
}

export function withIds(docs) {
  return docs.map(withId);
}
