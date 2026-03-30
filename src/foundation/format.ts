export { };

declare global {
	interface String {
		format(...args: any[]): string;
		formatWithBlank(...args: any[]): string;
	}
}

function myFormat(text: String, ...args: any[]) {

	const strict = true;
	function getString(arg: any): string {
		return String(arg);
	}

	const reg = /\$\$|\$\{([^}]*)\}/g;
	return text.replace(reg, (match, key) => {
		if (match === '$$') {
			return '$';
		}
		if (typeof key !== "string") {
			throw new Error(`String.format: invalid type of regex`);
		}

		// Integer index
		const digit = /^\d+$/;
		const index = Number(key);
		if (digit.test(key) && Number.isSafeInteger(index)) {
			const arg = args.at(index);
			if (strict && arg === undefined) {
				throw new Error(`String.format: missing positional argument ${index}`);
			}
			return arg !== undefined ? getString(arg) : match;
		}

		// Name index
		const names = key.split('.');
		if (names.length === 0) {
			if (strict) {
				throw new Error(`String.format: missing name-valued argument`);
			}
			return match;
		}
		let value: any = args.at(-1);
		for (const name of names) {
			if (typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, name)) {
				if (strict) {
					throw new Error(`String.format: name-valued argument "${key}" not found`);
				}
				return match;
			}
			value = value[name];
		}
		return getString(value);
	});
}

function formatWithBlank(text: String, ...args: any[]) {

	const strict = true;
	function getString(arg: any, length: number, offset: number): string {
		const value = String(arg);
		const prevChar = text[offset - 1] ?? "";
		const nextChar = text[offset + length] ?? "";
		const needLeftSpace = /[A-Za-z]/.test(prevChar) && /^[A-Za-z]/.test(value);
		const needRightSpace = /[A-Za-z]$/.test(value) && /[A-Za-z]/.test(nextChar);
		return (needLeftSpace ? " " : "") + value + (needRightSpace ? " " : "");
	}

	const reg = /\$\$|\$\{([^}]*)\}/g;
	return text.replace(reg, (match, key, offset) => {
		if (match === '$$') {
			return '$';
		}
		if (typeof key !== "string") {
			throw new Error(`String.format: invalid type of regex`);
		}

		// Integer index
		const digit = /^\d+$/;
		const index = Number(key);
		if (digit.test(key) && Number.isSafeInteger(index)) {
			const arg = args.at(index);
			if (strict && arg === undefined) {
				throw new Error(`String.format: missing positional argument ${index}`);
			}
			return arg !== undefined ? getString(arg, match.length, offset) : match;
		}

		// Name index
		const names = key.split('.');
		if (names.length === 0) {
			if (strict) {
				throw new Error(`String.format: missing name-valued argument`);
			}
			return match;
		}
		let value: any = args.at(-1);
		for (const name of names) {
			if (typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, name)) {
				if (strict) {
					throw new Error(`String.format: name-valued argument "${key}" not found`);
				}
				return match;
			}
			value = value[name];
		}
		return getString(value, match.length, offset);
	});
}

if (!String.prototype.format) {
	String.prototype.format = function (...args: any[]) {
		return myFormat(this, ...args);
	}
}

if (!String.prototype.formatWithBlank) {
	String.prototype.formatWithBlank = function (...args: any[]) {
		return formatWithBlank(this, ...args);
	}
}