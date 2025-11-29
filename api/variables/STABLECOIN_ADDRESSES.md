[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / STABLECOIN\_ADDRESSES

# Variable: STABLECOIN\_ADDRESSES

> `const` **STABLECOIN\_ADDRESSES**: `Record`\<[`StablecoinSymbol`](../type-aliases/StablecoinSymbol.md), `Partial`\<`Record`\<[`ChainId`](../type-aliases/ChainId.md), `string`\>\>\>

Defined in: [packages/sdk/src/payment/stablecoins.ts:91](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/payment/stablecoins.ts#L91)

Contract addresses by chain
Note: null means native or not available on that chain

Addresses verified from:
- USDC: https://www.circle.com/en/usdc
- USDT: https://tether.to/en/transparency
- DAI: https://docs.makerdao.com/
- Others: Official protocol documentation
