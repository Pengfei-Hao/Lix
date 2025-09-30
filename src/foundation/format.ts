



declare global {
	interface String {
		format(...args: any[]): string;
	}
}


/**
 * Safely read an own property (no prototype chain).
 */
function safeGetOwn(obj: Record<string, any>, key: string): any {
  return Object.prototype.hasOwnProperty.call(obj, key) ? obj[key] : undefined;
}

/**
 * Safely resolve dotted path like "a.b.c" from an object.
 * Returns undefined if any step is missing or not an object.
 */
function safeResolvePath(root: Record<string, any>, path: string): any {
  const parts = path.split(".");
  let cur: any = root;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, p)) return undefined;
    cur = cur[p];
  }
  return cur;
}

/**
 * Core formatting function. Single-pass regex replacement.
 *
 * PLACEHOLDER SYNTAX:
 *  - ${0} ${1} ... => positional arguments (from args array)
 *  - ${name}      => named lookup from namedArgs (first arg when named enabled and is a plain object)
 *  - ${a.b.c}     => nested property path access, safe (only own props)
 *  - $${...}      => escape: outputs `${...}` literally
 *
 * Behavior: no recursion — inserted values are not re-scanned for placeholders.
 */


if (!String.prototype.format) {
	String.prototype.format = function (...args: any[]) {
		const strict = false;

		const namedArgs =
				args.length > 0 &&
				args[0] != null &&
				typeof args[0] === "object" &&
				!Array.isArray(args[0])
				? args[0] as Record<string, any>
				: null;

		// regex matches either ${...} or $${...} (escape)
		// using \$\$?\{([^}]+)\}  -> matches '${key}' or '$${key}', group1 is key
		const re = /\$\$?\{([^}]+)\}/g;

		return this.replace(re, (match, inner) => {
			// If pattern was $${...} (escape), match starts with "$${"
			if (match.startsWith("$$")) {
				// Return literal ${inner}
				return "${" + inner + "}";
			}

			// numeric index?
			if (/^\d+$/.test(inner)) {
				const idx = Number(inner);
				if (idx < args.length) {
					return String(args[idx]);
				}
				if (strict) {
					throw new Error(`formatString: missing positional argument ${idx}`);
				}
				return match; // keep ${...} as-is
			}

			// named or dotted path
			if (namedArgs) {
				// dotted path resolution
				if (inner.includes(".")) {
					const v = safeResolvePath(namedArgs, inner);
					if (v !== undefined) return String(v);
				} else {
					const v = safeGetOwn(namedArgs, inner);
					if (v !== undefined) return String(v);
				}
			}

			// fallback: maybe it's a numeric-like string but with leading zeros etc -> try parseInt?
			// We already handled pure digits above; otherwise treat as missing
			if (strict) {
				throw new Error(`formatString: missing named argument "${inner}"`);
			}
			return match; // keep original ${...}
		});
	}
}

export { }; // 确保是模块，避免全局污染