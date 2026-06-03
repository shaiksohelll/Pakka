# 8. Withdraw Wallet RPC Migration

Date: 2026-05-21

## Status

Accepted

## Context

The `withdraw_wallet` functionality handles the movement of funds out of the platform's internal wallet system into an external account. During a code review in PR #19, several issues were identified in the original implementation regarding how ambiguous columns were referenced in SQL updates and the isolation of wallet withdrawal mechanics.

Specifically, the `withdraw_wallet` RPC required a robust lock to prevent race conditions during concurrent withdrawal attempts, and ambiguous columns in the `WHERE` clauses could lead to unintended variable shadowing in `plpgsql`.

## Decision

We rewrote the `public.withdraw_wallet(amount numeric, idempotency_key uuid)` RPC to ensure robust concurrency control and strict column disambiguation.

The key changes were:
1.  **Row-level Locking**: Utilizing `FOR UPDATE` on the user's wallet record to serialize concurrent withdrawal attempts and ensure the `available_balance` is precisely verified and debited.
2.  **Strict Disambiguation**: Prefixing all column references with table aliases (e.g., `w.profile_id`) and all PL/pgSQL variables with `v_` to eliminate shadowing bugs.
3.  **Idempotency**: Retaining the `p_idempotency_key` parameter (with a hard `NOT NULL` constraint) to insert into `escrow_ledger` under the `withdraw` type, using `(from_wallet, reference_id, type)` as the uniqueness guarantee to prevent duplicate deductions on network retries.

## Consequences

-   **Money-Safety**: Withdrawals are atomic, serialized, and idempotent, preventing double-withdrawals even if the client retries the same request simultaneously.
-   **Maintainability**: Eliminating variable shadowing prevents silent logic bugs where the database engine mistakenly compares a column against itself instead of the intended parameter.
-   **Traceability**: Each withdrawal leaves a permanent, immutable record in the `escrow_ledger` that corresponds precisely to a single debit in the `wallets` table.
