export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export function errorHandler(err, req, res, next) {
  if (err.isOperational) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  if (err.code === "P2002") {
    return res.status(409).json({ error: "A record with that value already exists." });
  }

  if (err.code === "P2025") {
    return res.status(404).json({ error: "Record not found." });
  }

  console.error("Unexpected error:", err);
  res.status(500).json({ error: "Internal server error" });
}
