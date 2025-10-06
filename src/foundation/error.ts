export class LixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LixError";
  }
}