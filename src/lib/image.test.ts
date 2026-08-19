import { describe, it, expect } from "vitest";
import { optimizedImage, srcSet } from "./image";

const SUPA = "https://abc.supabase.co/storage/v1/object/public/covers/a/b.jpg";

describe("optimizedImage", () => {
  it("rewrites Supabase public URLs to the render endpoint", () => {
    const out = optimizedImage(SUPA, { width: 640, quality: 70, format: "webp" });
    expect(out).toContain("/storage/v1/render/image/public/covers/a/b.jpg");
    expect(out).toContain("width=640");
    expect(out).toContain("quality=70");
    expect(out).toContain("format=webp");
    expect(out).toContain("resize=cover");
  });

  it("leaves non-Supabase URLs untouched", () => {
    const url = "https://cdn.example.com/x.png";
    expect(optimizedImage(url, { width: 100 })).toBe(url);
  });

  it("returns empty and invalid input unchanged", () => {
    expect(optimizedImage("")).toBe("");
    expect(optimizedImage("not a url")).toBe("not a url");
  });

  it("omits format when set to auto", () => {
    expect(optimizedImage(SUPA, { format: "auto" })).not.toContain("format=");
  });
});

describe("srcSet", () => {
  it("emits one candidate per width", () => {
    const out = srcSet(SUPA, [320, 640]);
    expect(out.split(", ")).toHaveLength(2);
    expect(out).toContain("320w");
    expect(out).toContain("640w");
  });
});
