# Verba 1.1.7 release validation

- The verified 1.1.7 Windows installer includes case-insensitive source glossary matching, startup glossary loading, and a local final warning for missing required terminology or explicit participant/payment reversals.
- Fix protected-entity substring counting: ID inside UID/TXID, USDT inside $USDT, and numeric account IDs inside currency amounts no longer cause false validation failures. Missing, duplicated, corrupted or leaked identifiers and changed amounts remain blocked.
- Failed requests hide the tone badge and disable copying the error as a translation. Success restores the normal controls.
- Existing startup defaults, user configuration and data storage, translation strategies and provider budgets remain unchanged.
- Validation: 89 local tests passed; three synthetic Gemini fixtures passed on their first request with no repair/fallback; packaged interface checks passed.
- Packaged version: 1.1.7. All 47 application source files matched the verified working source, and configured credentials were absent from the package.
- Installer SHA-256: `fb145797e1c74e95ea99420e3c89d2cc77b6ececf81dd645ad9202d7185af046`.
- Publish the verified installer together with its generated blockmap and latest.yml, following the existing local release process. These finite checks are not a guarantee of correctness for every translation.
