# Security Specification - Medical Checkup App

This specification details the Attribute-Based Access Control (ABAC) and Zero-Trust validation invariants for the medical checkup records application.

## 1. Data Invariants

- **Ownership Integrity**: Users may only read, list, create, update, or delete records that belong specifically to their authenticated user identifier (`userId`).
- **Schema Conformity**: Any records written must match the static validation types:
  - `id`: Non-empty string, matches ID regex, less than 128 characters.
  - `facility`: String between 1 and 200 characters.
  - `date`: Valid date string formatting (YYYY-MM-DD), exactly 10 characters.
  - `category`: Must be one of the six validated age groups.
  - `quantity`: Must be a positive integer greater than or equal to 0.
  - `createdAt`: Must be a valid integer tracking milliseconds.
- **Immutability Invariant**: Fields like `id`, `userId`, and `createdAt` cannot be modified under any update action.
- **Verified Sign-In**: Writing data is restricted to authenticated users.

---

## 2. The "Dirty Dozen" Malicious Payloads

The following payloads represent illegal write operations that must be rejected `(PERMISSION_DENIED)`:

1. **The Ghost Field (Shadow Update)**: Attempting to insert unmapped keys (`isVerifiedOwner: true` or `role: 'admin'`).
2. **The Identity Spoof (UserId Hijack)**: Creating a record with an owner ID different from `request.auth.uid`.
3. **The Privilege Escalation (Profile Role)**: Writing an unvalidated `role` property into records or users.
4. **The Negative Volume (Quantity Poisoning)**: Supplying a negative quantity, e.g., `quantity: -10`.
5. **The Bad Category (Enum Bypass)**: Supplying a non-existent category value like `"adults"`.
6. **The Giant Name (Denial of Wallet)**: Providing a 1MB string for `facility` to exhaust storage space.
7. **The ID Poisoning (Path Injection)**: Writing to a document ID container with characters outside of the safe `[a-zA-Z0-9_-]` regex.
8. **The Immutable Mutator**: Overwriting a record's original `userId` or `id` during update operations.
9. **The Blank Facility**: Creating a record where the facility name is empty or spaces.
10. **The Clock Manipulator**: Tampering or modifying `createdAt` during an update.
11. **The Relational Leak (Blanket List Query)**: Trying to read lists of records without filtering by `userId` to fetch other users' files.
12. **The Anonymous Writer**: Writing to the database without authentication or with unverified emails.

---

## 3. Test Runner Design

Below is a mock representation of tests to verify all 12 bad payloads are successfully rejected. We will implement these security barriers in `firestore.rules`.
