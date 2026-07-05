# Publishing to Greasy Fork

Greasy Fork has no publish API, but it can **auto-sync** from this repo's raw file.
Set it up once, then every release is just a `@version` bump + push.

## One-time setup

1. Sign in at <https://greasyfork.org> (GitHub/Google/email).
2. **Post script → Import from URL** (or paste the code):
   ```
   https://raw.githubusercontent.com/sfdye/endowus-goal-summer/main/endowus-goal-summer.user.js
   ```
3. After it's posted, open the script's **Admin → Sync** tab:
   - **Sync type:** Automatic
   - **Update source URL:**
     ```
     https://raw.githubusercontent.com/sfdye/endowus-goal-summer/main/endowus-goal-summer.user.js
     ```
   - Save. Greasy Fork now re-checks the raw file periodically and publishes any
     version whose `@version` is higher than the current one.
4. Copy the resulting script URL (e.g. `https://greasyfork.org/en/scripts/<id>`)
   and paste it into `README.md` where noted.

## Releasing a new version

1. Edit `endowus-goal-summer.user.js`.
2. Bump the `@version` line (Greasy Fork only picks up **higher** versions).
   Semantic-ish: `1.0.0 → 1.0.1` for fixes, `→ 1.1.0` for features.
3. Commit, tag, and push:
   ```bash
   git commit -am "fix: <what changed>"
   git tag v1.0.1 && git push --tags && git push
   ```
4. Greasy Fork auto-syncs within its polling window. To publish immediately,
   open **Admin → Sync → Sync now**.

Users who installed via Tampermonkey/Violentmonkey get the update automatically
too, via the `@updateURL`/`@downloadURL` pointing at the same raw file.

## Notes

- Keep `@downloadURL`, `@updateURL`, and the Greasy Fork sync URL all pointing at
  the `main` branch raw file so GitHub-installed and Greasy-Fork-installed users
  stay in lockstep.
- The `Validate userscript` GitHub Action checks syntax and the metadata block on
  every push, so a broken script never reaches `main`.
