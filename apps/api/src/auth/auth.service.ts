import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";

interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
}

// In-memory user store for MVP — seeded from env (ADMIN_EMAIL/ADMIN_PASSWORD).
// No hardcoded fallback: if env vars are missing, login simply fails.
const USERS: User[] = [];
const adminEmail = process.env.ADMIN_EMAIL?.trim();
const adminPassword = process.env.ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  USERS.push({
    id: "admin_1",
    email: adminEmail,
    passwordHash: bcrypt.hashSync(adminPassword, 10),
    name: process.env.ADMIN_NAME?.trim() || "Admin",
  });
} else {
  console.warn(
    "[AUTH] ADMIN_EMAIL/ADMIN_PASSWORD not set — no users seeded; /api/auth/login will reject all attempts."
  );
}

@Injectable()
export class AuthService {
  constructor(private readonly jwt: JwtService) {}

  async register(email: string, password: string, name: string) {
    const existing = USERS.find((u) => u.email === email);
    if (existing) throw new UnauthorizedException("Email already registered");

    const passwordHash = await bcrypt.hash(password, 10);
    const user: User = { id: crypto.randomUUID(), email, passwordHash, name };
    USERS.push(user);

    return this.issueTokens(user);
  }

  async login(email: string, password: string) {
    const user = USERS.find((u) => u.email === email);
    if (!user) throw new UnauthorizedException("Invalid credentials");

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException("Invalid credentials");

    return this.issueTokens(user);
  }

  private issueTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: "super_admin" };
    return {
      access_token: this.jwt.sign(payload),
      user: { id: user.id, email: user.email, name: user.name },
    };
  }
}
