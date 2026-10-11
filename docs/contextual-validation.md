# Contextual input guidance

PR #41 was merged before this follow-up. This change adds deterministic Arabic explanations to customer/policy forms, linked error summaries, validation on blur, and advisory checks for national ID, phone and future birth dates. Advisory checks never alter values or prevent saving. Duplicate customer/policy identifiers remain visible in the form with corrective instructions.

Existing customer rules declare optional legacy fields, but empty number inputs produced NaN and blank selects produced empty strings, preventing schema validation. These UI empty values now map to undefined, allowing existing optional fields while retaining requirements for new customers and manager ownership. Zero deposits remain valid.

The shared payment confirmation no longer crashes when its date is cleared, explains invalid dates, and enforces its existing maximum of today before confirmation. These are UI guards; authoritative server checks remain unchanged. Payment and cancellation dialogs cannot dismiss while processing. Customer/policy save handlers guard overlapping submissions synchronously.

Calculation modules, pricing, commission rules, database migrations, payment RPCs, and financial operation implementations are unchanged. No external AI service receives customer information. These checks cover observed cases, not every possible future error.

Verification: automated component/schema/regression tests, lint, TypeScript, production build. Full browser visual verification and live backend workflows remain outstanding due to the browser limitation documented in reliability-upgrade.md. No production financial operations are performed as tests.
