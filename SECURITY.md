# Security Policy

## Supported version

Security fixes target the latest default branch.

## Reporting

Please report suspected vulnerabilities privately through GitHub Security
Advisories. Include reproduction steps, affected package versions, and example
documents if relevant.

Please do not open public issues for unreported security problems.

## Handling model input

Recipes may come from untrusted users, scraped pages, screenshots, or language
models. The parser extracts JSON, validates it against the schema, verifies IDs
and acyclicity, and escapes all strings during HTML rendering. Do not bypass
these layers when integrating the packages.
