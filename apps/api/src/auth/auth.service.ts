import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { AppConfigService } from "../shared/config/app-config.service";

interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly users: User[] = [];

  constructor(
    private readonly jwt: JwtService,
    config: AppConfigService
  ) {
    const { adminEmail, adminPassword, adminName } = config.values;
    if (adminEmail && adminPassword) {
      this.users.push({
        id: "admin_1",
        email: adminEmail,
        passwordHash: bcrypt.hashSync(adminPassword, 10),
        name: adminName,
      });
    } else {
      this.logger.warn(
        "ADMIN_EMAIL/ADMIN_PASSWORD not set - no users seeded; /api/auth/login will reject all attempts."
      );
    }
  }

  async register(email: string, password: string, name: string) {
    const existing = this.users.find((u) => u.email === email);
    if (existing) throw new UnauthorizedException("Email already registered");

    const passwordHash = await bcrypt.hash(password, 10);
    const user: User = { id: crypto.randomUUID(), email, passwordHash, name };
    this.users.push(user);

    return this.issueTokens(user);
  }

  async login(email: string, password: string) {
    const user = this.users.find((u) => u.email === email);
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
