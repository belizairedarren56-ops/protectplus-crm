import { afterEach, describe, expect, it, vi } from "vitest";
import { DataBackendConfigError, getDataBackend } from "@/lib/dataMode";

const ENV_KEY = "NEXT_PUBLIC_DATA_BACKEND";

describe("getDataBackend", () => {
  afterEach(() => {
    delete process.env[ENV_KEY];
    vi.unstubAllEnvs();
  });

  it("returns 'supabase' when explicitly set", () => {
    process.env[ENV_KEY] = "supabase";
    expect(getDataBackend()).toBe("supabase");
  });

  it("returns 'demo' when explicitly set", () => {
    process.env[ENV_KEY] = "demo";
    expect(getDataBackend()).toBe("demo");
  });

  it("defaults to 'demo' when unset outside production", () => {
    delete process.env[ENV_KEY];
    expect(process.env.NODE_ENV).not.toBe("production");
    expect(getDataBackend()).toBe("demo");
  });

  it("fails closed (throws) when unset in production", () => {
    delete process.env[ENV_KEY];
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getDataBackend()).toThrow(DataBackendConfigError);
  });

  it("fails closed (throws) when set to an invalid value in production", () => {
    process.env[ENV_KEY] = "not-a-real-backend";
    vi.stubEnv("NODE_ENV", "production");
    expect(() => getDataBackend()).toThrow(DataBackendConfigError);
  });
});
