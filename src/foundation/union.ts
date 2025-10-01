export {}; // 确保这是一个模块而不是全局脚本

declare global {
  interface Set<T> {
    /**
     * Return a new Set that is the union of this set and another set.
     * The original sets remain unchanged.
     */
    union(other: Set<T>): Set<T>;
  }
}

if (!Set.prototype.union) {
  Set.prototype.union = function <T>(this: Set<T>, other: Set<T>): Set<T> {
    const result = new Set<T>(this); // 复制当前集合
    for (const elem of other) {
      result.add(elem);
    }
    return result;
  };
}