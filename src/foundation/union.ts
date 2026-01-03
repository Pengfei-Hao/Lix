export { };

declare global {
	interface Set<T> {
		union(other: Set<T>): Set<T>;
	}
}

if (!Set.prototype.union) {
	Set.prototype.union = function <T>(this: Set<T>, other: Set<T>): Set<T> {
		const result = new Set<T>(this);
		for (const elem of other) {
			result.add(elem);
		}
		return result;
	};
}