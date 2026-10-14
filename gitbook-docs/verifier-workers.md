# Independent verifier workers

Enroll verifier runners from accounts other than the machine owner, each proving control of its own globally unique Ed25519 key. A verifier leases a pinned replay job, checks the patch digest and deterministic candidate commit, measures baseline and candidate in the same image, and signs the callback.

## Exclusions

The author's key, any key already used on the candidate, and same-owner runners are excluded at lease, callback, and judge. Signing keys are globally unique across all accounts.

## What this proves — and what it doesn't

Account separation plus proof of key control is **not** Sybil resistance and does **not** prove separate physical hosts. It is operator attestation: each enrolled runner proved possession of a distinct private key bound to a distinct account.

## Enrollment

Enrollment requires a short-lived (5 minute), single-use, owner-bound server challenge. The runner generates its key locally, signs the challenge text on the host, and only the public key and signature are pasted into the app. Runners enrolled before key proof cannot lease jobs; owners re-enroll them with proof.
