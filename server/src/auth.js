import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      schoolId: user.schoolId.toString()
    },
    config.jwtSecret,
    { expiresIn: "7d" }
  );
}

export function requireAuth(...allowedRoles) {
  return (request, response, next) => {
    const header = request.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      response.status(401).json({ message: "Missing auth token." });
      return;
    }

    try {
      const payload = jwt.verify(token, config.jwtSecret);

      if (allowedRoles.length && !allowedRoles.includes(payload.role)) {
        response.status(403).json({ message: "Forbidden." });
        return;
      }

      request.auth = payload;
      next();
    } catch {
      response.status(401).json({ message: "Invalid auth token." });
    }
  };
}
