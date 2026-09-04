import { promises as fs } from "node:fs";
import path from "node:path";
import { safeStorage } from "electron";
import {
  AuthSessionError,
  MAX_TOKEN_FIELD_CHARS,
  type EncryptedRefreshTokenStore,
} from "./auth-session";

export const AUTH_SESSION_FILENAME = "milo-auth-session.bin";
const MAX_ENCRYPTED_SESSION_BYTES = 16 * 1024;

/**
 * Stores only the encrypted rotated refresh token in the fixed Electron userData location.
 * Access tokens are intentionally not handled here and remain memory-only in AuthSession.
 */
export function createElectronRefreshTokenStore(userDataPath: string): EncryptedRefreshTokenStore {
  const root = path.resolve(userDataPath);
  const filePath = path.join(root, AUTH_SESSION_FILENAME);

  return {
    isEncryptionAvailable: () => safeStorage.isEncryptionAvailable(),
    read: async () => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new AuthSessionError("AUTH_STORAGE_UNAVAILABLE", "Milo cannot decrypt the saved sign-in session.");
      }
      let encrypted: Buffer;
      try {
        encrypted = await fs.readFile(filePath);
      } catch (error) {
        if (isNotFound(error)) return null;
        throw new AuthSessionError("AUTH_STORAGE_FAILED", "Milo could not read the saved sign-in session.");
      }
      if (encrypted.length === 0 || encrypted.length > MAX_ENCRYPTED_SESSION_BYTES) {
        throw new AuthSessionError("AUTH_STORAGE_CORRUPT", "Milo could not verify the saved sign-in session.");
      }
      try {
        const token = safeStorage.decryptString(encrypted);
        if (!isRefreshToken(token)) throw new Error("INVALID_REFRESH_TOKEN");
        return token;
      } catch {
        throw new AuthSessionError("AUTH_STORAGE_CORRUPT", "Milo could not verify the saved sign-in session.");
      }
    },
    write: async (refreshToken: string) => {
      if (!safeStorage.isEncryptionAvailable()) {
        throw new AuthSessionError("AUTH_STORAGE_UNAVAILABLE", "Milo cannot securely save the sign-in session.");
      }
      if (!isRefreshToken(refreshToken)) {
        throw new AuthSessionError("AUTH_STORAGE_CORRUPT", "Milo rejected an invalid refresh token.");
      }
      const encrypted = safeStorage.encryptString(refreshToken);
      if (encrypted.length === 0 || encrypted.length > MAX_ENCRYPTED_SESSION_BYTES) {
        throw new AuthSessionError("AUTH_STORAGE_FAILED", "Milo could not securely save the sign-in session.");
      }
      try {
        await fs.mkdir(root, { recursive: true });
        await fs.writeFile(filePath, encrypted, { mode: 0o600 });
      } catch {
        throw new AuthSessionError("AUTH_STORAGE_FAILED", "Milo could not securely save the sign-in session.");
      }
    },
    clear: async () => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        if (!isNotFound(error)) {
          throw new AuthSessionError("AUTH_STORAGE_FAILED", "Milo could not clear the saved sign-in session.");
        }
      }
    },
  };
}

function isRefreshToken(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_TOKEN_FIELD_CHARS && !/[\u0000-\u001f\u007f]/.test(value);
}

function isNotFound(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
