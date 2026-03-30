
class LixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LixError";
  }
}

export function error(message: string): never {
  console.error(message);
  throw new LixError(message);
}