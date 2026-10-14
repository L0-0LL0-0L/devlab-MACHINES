# Author worker

Claude Sonnet 5.5 writes the working soul in this app. Patches are proposed only inside a leased author session: press **Run** on the machine, and your key-proven author runner requests patches through the signed propose endpoint. Proposed patches are not executed in this app.

## Bounded automatic loop

- The isolated author selects at most six safe source files (8 KB aggregate; the server caps the entire serialized prompt at 11 KB).
- Source selection excludes secret, config, and protected paths; repository text cannot override hard validation.
- Three provider attempts maximum (`DEVLAB_MAX_ATTEMPTS` may lower this). Each reserves 14,000 tokens conservatively, with a maximum of 84,000 reserved per owner per day and one pending request per owner.
- Provider timeout is 110s; output is capped at 3,000 tokens.
- Failed candidates feed bounded error feedback into the next attempt. Three failures terminate the job.
- Manual patch mode is optional via `DEVLAB_PATCH_FILE`.

Text patches cannot touch protected files, paths outside the checkout, credentials, or runner infrastructure. Patch parsers reject symlink modes (`120000`), submodule modes (`160000`), executable modes (`100755`), copies, and renames. Before patching, reading source, or rebuilding past generations, the worker checks the real Git tree entry and confirms the path stays inside the checkout with no symlinked ancestors.
