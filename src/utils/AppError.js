export class AppError extends Error {
  constructor(statusCode, message, meta = null) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.meta = meta;
  }
}
