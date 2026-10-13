#!/usr/bin/env python3
"""Reproducibly package the self-hosted runner. Allowlist only; fixed timestamps and order."""
import hashlib, pathlib, zipfile

VERSION = "2.1.0"
ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = [
    "worker.py",
    "devlab_enroll.py",
    "requirements.txt",
    "Dockerfile",
    "devlab-runner.service",
    "README.md",
    "runner.env.example",
]
OUT = ROOT / "public" / "downloads" / f"devlab-runner-v{VERSION}.zip"


def build():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT.with_suffix(".tmp")
    with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as z:
        for name in FILES:
            data = (ROOT / "runner" / name).read_bytes()
            info = zipfile.ZipInfo(f"devlab-runner-v{VERSION}/{name}", date_time=(2026, 1, 1, 0, 0, 0))
            info.external_attr = (0o755 if name.endswith(".py") else 0o644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, data, compresslevel=9)
    tmp.replace(OUT)
    digest = hashlib.sha256(OUT.read_bytes()).hexdigest()
    (OUT.parent / (OUT.name + ".sha256")).write_text(f"{digest}  {OUT.name}\n")
    return digest


if __name__ == "__main__":
    print(build())
