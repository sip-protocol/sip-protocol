# Changelog

## 0.1.1

### Fixed

- `buildPublishTx` now writes the record value to the SNS account. v0.1.0 only
  emitted Bonfida's `createInstruction`, which allocates the record account but
  passes `undefined` as initial data — the published record was N bytes of
  zeros and `resolveSIPStealth` returned `NotFound('record')`. Confirmed on
  mainnet against `therector.sol`: TX
  [`62fc8WSK…pwj`](https://solscan.io/tx/62fc8WSKtjhK5tZGhn7nccTej2akxWf5RGvH5tE1DccbyYGyTGo7VC51hfjT6yFmLxmVoxwR2Hq67Tq7YJTnpwj)
  succeeded but the resulting record account
  [`3Vu5iLwr…NhkH`](https://solscan.io/account/3Vu5iLwrdgaU8gA3tJFY6rao9mXNnGicTVCkkXzhNhkH)
  held 162 bytes of zeros.

  The fix mirrors Bonfida's own `updateRecordInstruction` flow:
  - account missing → `createInstruction` (allocate) + `updateInstruction` (write)
  - account size matches → `updateInstruction` only
  - account size differs → `deleteInstruction` + `createInstruction` + `updateInstruction`

  Republishing on a domain that holds an empty record from v0.1.0 succeeds
  without manual cleanup — the matching-size path overwrites the zeros in
  place.

### Tests

- Added wire-format unit tests that decode the resulting `Transaction` and
  assert on Bonfida's documented instruction discriminators (0/1/3) for all
  three account-state paths. Phase A's mock-based tests passed against the
  broken code because they only verified arguments to `createRecordInstruction`,
  never read the on-chain record back.
- Tightened `tests/integration.test.ts` to require an explicit
  `SIP_TEST_DOMAIN` env var. The previous default (`test.sipher.sol`) wasn't
  provisioned on devnet so the test failed for anyone with the shared keypair.

## 0.1.0

Initial release. SNS-based stealth address resolution and publishing.
