import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { memoryStorage } from "@/test/memory-storage";
import { rememberReturnPath, safeReturnPath, takeReturnPath } from "./return-path";

describe("safeReturnPath", () => {
  it("keeps paths inside the site", () => {
    expect(safeReturnPath("/article/art_1")).toBe("/article/art_1");
    expect(safeReturnPath("/map?story=art_1&view=list")).toBe("/map?story=art_1&view=list");
    expect(safeReturnPath("/")).toBe("/");
  });

  it("refuses anything that leaves the site", () => {
    expect(safeReturnPath("//evil.example/x")).toBeNull();
    expect(safeReturnPath("/\\evil.example")).toBeNull();
    expect(safeReturnPath("https://evil.example")).toBeNull();
    expect(safeReturnPath("javascript:alert(1)")).toBeNull();
    expect(safeReturnPath("article/x")).toBeNull();
    expect(safeReturnPath(null)).toBeNull();
    expect(safeReturnPath("/" + "a".repeat(600))).toBeNull();
  });

  it("never sends a reader back to the sign-in pages", () => {
    expect(safeReturnPath("/auth")).toBeNull();
    expect(safeReturnPath("/auth?mode=signup")).toBeNull();
    expect(safeReturnPath("/auth/callback")).toBeNull();
    expect(safeReturnPath("/reset-password")).toBeNull();
    expect(safeReturnPath("/authors")).toBe("/authors");
  });
});

describe("remember / take", () => {
  beforeEach(() => vi.stubGlobal("sessionStorage", memoryStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it("hands the path back once", () => {
    rememberReturnPath("/article/art_1");
    expect(takeReturnPath()).toBe("/article/art_1");
    expect(takeReturnPath()).toBeNull();
  });

  it("an unsafe path clears the one remembered before it", () => {
    rememberReturnPath("/article/art_1");
    rememberReturnPath("//evil.example");
    expect(takeReturnPath()).toBeNull();
  });
});
