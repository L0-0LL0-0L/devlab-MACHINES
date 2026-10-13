import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const ZIP = "public/downloads/devlab-runner-v2.1.0.zip";
function entries(buf: Buffer) {
  // Parse ZIP central directory names.
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    const n = buf.readUInt16LE(off + 28),
      x = buf.readUInt16LE(off + 30),
      c = buf.readUInt16LE(off + 32);
    names.push(buf.subarray(off + 46, off + 46 + n).toString("utf8"));
    off += 46 + n + x + c;
  }
  return names;
}

describe("runner download package", () => {
  const buf = readFileSync(ZIP);
  it("is a ZIP with exactly the allowlisted files", () => {
    expect(buf.subarray(0, 4)).toEqual(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
    expect(entries(buf).sort()).toEqual(
      [
        "Dockerfile",
        "README.md",
        "devlab-runner.service",
        "devlab_enroll.py",
        "requirements.txt",
        "runner.env.example",
        "worker.py",
      ]
        .map((f) => "devlab-runner-v2.1.0/" + f)
        .sort(),
    );
  });
  it("contains no secrets, caches or fixtures", () => {
    const names = entries(buf).join("\n");
    expect(names).not.toMatch(/\.env$|__pycache__|test_|session|\.key$|\.pem$/m);
    const env = readFileSync("runner/runner.env.example", "utf8");
    expect(env).toMatch(/^DEVLAB_RUNNER_TOKEN=$/m);
    expect(env).toMatch(/^DEVLAB_URL=$/m);
  });
  it("is current and reproducible", () => {
    const before = createHash("sha256").update(buf).digest("hex");
    execFileSync("python3", ["scripts/build-runner-zip.py"]);
    const after = createHash("sha256").update(readFileSync(ZIP)).digest("hex");
    expect(after).toBe(before);
    expect(readFileSync(ZIP + ".sha256", "utf8")).toContain(after);
  });
});
