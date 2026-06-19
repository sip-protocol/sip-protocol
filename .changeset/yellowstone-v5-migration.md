---
"@sip-protocol/sdk": patch
---

Migrate `@triton-one/yellowstone-grpc` (4.x → 5.x) in the Solana gRPC providers. v5 moved off `@grpc/grpc-js` (its `Client.subscribe()` now returns the library's own `ClientDuplexStream` instead of `@grpc/grpc-js`'s generic `ClientDuplexStream<SubscribeRequest, SubscribeUpdate>`). The QuickNode and Triton providers now alias the stream to v5's exported `ClientDuplexStream` and type their `data` handlers as `SubscribeUpdate`, dropping the now-unused `@grpc/grpc-js` dev dependency. No public API or runtime behavior change.
