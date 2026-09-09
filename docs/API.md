# Alvora API — route manifest

Base URL: `/api` (nginx proxies it to the API process). Every request and response
body is validated against a zod contract exported from `@alvora/shared`.

Conventions:
- Auth is a `alv_at` httpOnly access-token cookie (15 min) plus a `alv_rt` refresh
  cookie (30 days, rotating). `Authorization: Bearer <token>` is also accepted so
  the WebSocket handshake and scripts can authenticate.
- Every fixed-point value crosses the wire as the **decimal string of a 1e8-scaled
  integer** (`"12345678900"`), never as a JSON number.
- Errors are `{ "error": { "code", "message", "details"? } }` with `code` from
  `ERROR_CODES`.
- List endpoints take `?limit=&cursor=` and return `{ items, nextCursor }`.
- Mutating routes accept an `Idempotency-Key` header where noted.

| Method | Path | Auth | Body / Query | Returns |
| --- | --- | --- | --- | --- |
| GET | `/health` | – | – | `{ status, uptime, db, engine }` |
| POST | `/auth/signup` | – | `zSignupInput` | `zAuthResponse` |
| POST | `/auth/login` | – | `zLoginInput` | `zAuthResponse` |
| POST | `/auth/refresh` | cookie | – | `zAuthResponse` |
| POST | `/auth/logout` | user | – | `{ ok: true }` |
| GET | `/auth/me` | user | – | `zSessionUser` |
| POST | `/auth/password` | user | `zChangePasswordInput` | `{ ok: true }` |
| GET | `/auth/sessions` | user | – | active sessions |
| DELETE | `/auth/sessions/:id` | user | – | `{ ok: true }` |
| GET | `/assets` | – | `zAssetListQuery` | paginated `zAsset` |
| GET | `/assets/:ticker` | – | – | `zAsset` + stats |
| GET | `/assets/:ticker/candles` | – | `zCandleQuery` | `zCandle[]` |
| GET | `/assets/:ticker/book` | – | `?depth=` | `zOrderBook` |
| GET | `/assets/:ticker/trades` | – | `?limit=` | `zTrade[]` |
| GET | `/assets/:ticker/events` | – | `?limit=` | `zMarketEvent[]` |
| GET | `/market/movers` | – | – | `{ gainers, losers, mostActive }` |
| GET | `/market/overview` | – | – | indices, sentiment, totals |
| GET | `/market/events` | – | `?limit=` | `zMarketEvent[]` |
| POST | `/orders` | user | `zPlaceOrderInput` | `zOrder` |
| GET | `/orders` | user | `?status=&ticker=` | paginated `zOrder` |
| DELETE | `/orders/:id` | user | – | `zOrder` |
| DELETE | `/orders` | user | `?ticker=` | `{ cancelled: n }` |
| GET | `/portfolio` | user | `?companyId=` | `zPortfolio` |
| GET | `/portfolio/history` | user | `?period=` | `zNetWorthPoint[]` |
| GET | `/portfolio/transactions` | user | `zLedgerQuery` | paginated `zTransactionRow` |
| GET | `/portfolio/ledger` | user | `zLedgerQuery` | paginated `zLedgerEntry` |
| GET | `/watchlist` | user | – | `zAsset[]` |
| POST | `/watchlist` | user | `zWatchlistInput` | `{ ok }` |
| DELETE | `/watchlist/:ticker` | user | – | `{ ok }` |
| GET | `/alerts` | user | – | price alerts |
| POST | `/alerts` | user | `zPriceAlertInput` | alert |
| DELETE | `/alerts/:id` | user | – | `{ ok }` |
| GET | `/wallets` | user | – | `zWalletSummary` |
| POST | `/wallets/:chain` | user | – | creates the wallet if missing |
| GET | `/wallets/transactions` | user | `zChainTxQuery` | paginated `zChainTransaction` |
| POST | `/wallets/send` | user | `zSendInput` | `zChainTransaction` |
| POST | `/wallets/transfer` | user | `zWalletTransferInput` | `zChainTransaction` |
| POST | `/wallets/swap/quote` | user | `zSwapInput` | `zSwapQuote` |
| POST | `/wallets/swap` | user | `zSwapInput` | `zChainTransaction` |
| GET | `/wallets/stakes` | user | – | `zStakePosition[]` |
| POST | `/wallets/stake` | user | `zStakeInput` | `zStakePosition` |
| POST | `/wallets/stakes/:id/unstake` | user | – | `zStakePosition` |
| GET | `/wallets/address-book` | user | – | entries |
| POST | `/wallets/address-book` | user | `zAddressBookInput` | entry |
| DELETE | `/wallets/address-book/:id` | user | – | `{ ok }` |
| GET | `/mining` | user | `?companyId=` | `zMiningStatus` |
| GET | `/mining/catalogue` | – | – | rig catalogue with live economics |
| POST | `/mining/rigs` | user | `zRigPurchaseInput` | `zMiningStatus` |
| DELETE | `/mining/rigs/:rigId` | user | `?quantity=&companyId=` | `zMiningStatus` |
| GET | `/mining/rewards` | user | `?limit=` | reward history |
| GET | `/companies` | – | `zCompanyListQuery` | paginated `zCompanySummary` |
| POST | `/companies` | user | `zCreateCompanyInput` | `zCompanyDetail` |
| GET | `/companies/:id` | – | – | `zCompanyDetail` |
| PATCH | `/companies/:id` | member | `zUpdateCompanyInput` | `zCompanyDetail` |
| POST | `/companies/:id/treasury/deposit` | member | `zTreasuryInput` | `zCompanyDetail` |
| POST | `/companies/:id/treasury/withdraw` | member | `zTreasuryInput` | `zCompanyDetail` |
| POST | `/companies/:id/ipo` | ceo | `zIpoInput` | `zCompanyDetail` |
| POST | `/companies/:id/shares/issue` | ceo | `zIssueSharesInput` | `zCompanyDetail` |
| POST | `/companies/:id/shares/buyback` | ceo | `zBuybackInput` | `zCompanyDetail` |
| POST | `/companies/:id/dividend` | ceo/director | `zDividendInput` | `zCompanyDetail` |
| POST | `/companies/:id/members` | ceo/director | `zMemberInviteInput` | `zCompanyDetail` |
| PATCH | `/companies/:id/members/:userId` | ceo | `zMemberRoleInput` | `zCompanyDetail` |
| DELETE | `/companies/:id/members/:userId` | ceo | – | `zCompanyDetail` |
| PATCH | `/companies/:id/salaries` | ceo | `zSalaryInput` | `zCompanyDetail` |
| GET | `/companies/:id/events` | – | `?limit=` | `zCompanyEvent[]` |
| GET | `/companies/:id/ledger` | member | `zLedgerQuery` | paginated `zLedgerEntry` |
| GET | `/predictions` | – | `zMarketListQuery` | paginated `zPredictionMarket` |
| POST | `/predictions` | user | `zCreateMarketInput` | `zPredictionMarket` |
| GET | `/predictions/:id` | – | – | `zPredictionMarket` |
| POST | `/predictions/:id/bets` | user | `zPlaceBetInput` | `zPredictionMarket` |
| POST | `/predictions/:id/settle` | creator/admin | `zSettleMarketInput` | `zPredictionMarket` |
| POST | `/predictions/:id/cancel` | creator/admin | – | `zPredictionMarket` |
| GET | `/otc` | user | `?mineOnly=` | paginated `zOtcOffer` |
| POST | `/otc` | user | `zOtcOfferInput` | `zOtcOffer` |
| POST | `/otc/:id/accept` | user | – | `zOtcOffer` |
| DELETE | `/otc/:id` | user | – | `zOtcOffer` |
| GET | `/loans` | user | – | `zLoan[]` |
| POST | `/loans` | user | `zLoanInput` | `zLoan` |
| POST | `/loans/:id/repay` | user | `{ amount }` | `zLoan` |
| GET | `/leaderboard` | – | `zLeaderboardQuery` | paginated `zLeaderboardEntry` |
| GET | `/users/:id` | – | – | `zPublicProfile` |
| PATCH | `/me` | user | `zUpdateProfileInput` | `zSessionUser` |
| GET | `/me/achievements` | user | – | achievements |
| POST | `/me/daily-bonus` | user | – | `{ amount }` |
| GET | `/notifications` | user | `zNotificationQuery` | paginated `zNotification` |
| POST | `/notifications/read` | user | `{ ids? }` | `{ ok }` |
| GET | `/chat/:room` | user | `?limit=` | `zChatMessage[]` |
| GET | `/search` | – | `zSearchQuery` | `zSearchResults` |
| GET | `/admin/stats` | admin | – | `zAdminStats` |
| GET | `/admin/users` | admin | `zAdminUserQuery` | paginated `zAdminUserRow` |
| POST | `/admin/users/cash` | admin | `zAdjustCashInput` | `{ ok }` |
| POST | `/admin/users/role` | admin | `zSetRoleInput` | `{ ok }` |
| POST | `/admin/users/status` | admin | `zSetStatusInput` | `{ ok }` |
| POST | `/admin/assets` | admin | `zAdminAssetInput` | `zAsset` |
| PATCH | `/admin/assets/:ticker` | admin | `zAdminAssetInput` | `zAsset` |
| POST | `/admin/events` | admin | `zAdminEventInput` | `zMarketEvent` |
| GET | `/admin/audit` | admin | `zAuditQuery` | paginated audit rows |

## WebSocket

Socket.IO at path `/ws`, same origin. The handshake carries the access token in
`auth.token`; an unauthenticated socket may still subscribe to public rooms.
Event names and payloads are the `ServerToClientEvents` / `ClientToServerEvents`
interfaces in `@alvora/shared/events`.
