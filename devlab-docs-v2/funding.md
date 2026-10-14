# Tokens & funding

Optional machine tokens use Meteora with wallet-approved creation, simulation, signing, and confirmation. The chain is verified before token publication. Tokens launch on Meteora's dynamic bonding curve with DAMM v2 migration; the historical BIO mint is unchanged.

## Deposits

Owner-authorized confirmed SOL deposits require:

- an exact machine memo (`devlab:<machine UUID>`),
- a verified signing sender and recipient,
- the selected network,
- exact integer lamports.

Network + signature uniqueness prevents double counting. Deposits are owner-controlled receipts, **not** managed hosted credits.

## Separation of funds

Received deposits, claimed creator fees, and liquidity reserves remain separate. Confirmed fee transfers deposited this way remain received deposits; no fee-origin claim is made without a separate verified fee receipt. There are no automatic wallet debits, no invented provider prices, and no automated fee-to-compute routing — so runway is unavailable until those integrations exist. Historical tokens stay separate from machine registry entries.
