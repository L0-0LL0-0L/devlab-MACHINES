#!/usr/bin/env python3
"""devlab MACHINES runner enrollment CLI.

Keys are generated and kept on this host. Only the Base64 PUBLIC key and a signature
over the server's enrollment challenge ever leave the machine.

  python3 devlab_enroll.py keygen  --out /etc/devlab/signing.key
  python3 devlab_enroll.py pubkey  --key /etc/devlab/signing.key
  python3 devlab_enroll.py sign    --key /etc/devlab/signing.key --challenge challenge.txt
"""
import argparse, base64, os, pathlib, sys
from nacl.signing import SigningKey

PREFIX = "devlab-runner-enrollment-v1\n"


def load(path):
    raw = pathlib.Path(path).read_text().strip()
    seed = base64.b64decode(raw, validate=True)
    if len(seed) != 32:
        raise SystemExit("Signing key file must hold a 32-byte Base64 seed")
    return SigningKey(seed)


def public_b64(key):
    return base64.b64encode(bytes(key.verify_key)).decode()


def keygen(out):
    p = pathlib.Path(out)
    if p.exists():
        raise SystemExit(f"{out} already exists; refusing to overwrite")
    p.parent.mkdir(parents=True, exist_ok=True)
    key = SigningKey.generate()
    fd = os.open(p, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w") as f:
        f.write(base64.b64encode(bytes(key)).decode() + "\n")
    return public_b64(key)


def sign_challenge(key, message):
    if not message.startswith(PREFIX):
        raise SystemExit("Not a devlab runner enrollment challenge")
    lines = dict(l.split(":", 1) for l in message.split("\n")[1:] if ":" in l)
    if lines.get("key") != public_b64(key):
        raise SystemExit("Challenge is for a different public key")
    return base64.b64encode(key.sign(message.encode()).signature).decode()


def main(argv=None):
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("keygen"); g.add_argument("--out", required=True)
    k = sub.add_parser("pubkey"); k.add_argument("--key", required=True)
    s = sub.add_parser("sign"); s.add_argument("--key", required=True)
    s.add_argument("--challenge", help="file with exact challenge text; default stdin")
    a = ap.parse_args(argv)
    if a.cmd == "keygen":
        print(keygen(a.out))
    elif a.cmd == "pubkey":
        print(public_b64(load(a.key)))
    else:
        text = pathlib.Path(a.challenge).read_text() if a.challenge else sys.stdin.read()
        print(sign_challenge(load(a.key), text.rstrip("\n")))


if __name__ == "__main__":
    main()
