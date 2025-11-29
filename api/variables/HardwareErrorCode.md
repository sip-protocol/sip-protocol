[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / HardwareErrorCode

# Variable: HardwareErrorCode

> `const` **HardwareErrorCode**: `object`

Defined in: [packages/sdk/src/wallet/hardware/types.ts:240](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/wallet/hardware/types.ts#L240)

Hardware wallet error codes

## Type Declaration

### DEVICE\_NOT\_FOUND

> `readonly` **DEVICE\_NOT\_FOUND**: `"HARDWARE_DEVICE_NOT_FOUND"` = `'HARDWARE_DEVICE_NOT_FOUND'`

Device not found/connected

### DEVICE\_LOCKED

> `readonly` **DEVICE\_LOCKED**: `"HARDWARE_DEVICE_LOCKED"` = `'HARDWARE_DEVICE_LOCKED'`

Device is locked (requires PIN)

### APP\_NOT\_OPEN

> `readonly` **APP\_NOT\_OPEN**: `"HARDWARE_APP_NOT_OPEN"` = `'HARDWARE_APP_NOT_OPEN'`

Required app not open on device

### USER\_REJECTED

> `readonly` **USER\_REJECTED**: `"HARDWARE_USER_REJECTED"` = `'HARDWARE_USER_REJECTED'`

User rejected on device

### TRANSPORT\_ERROR

> `readonly` **TRANSPORT\_ERROR**: `"HARDWARE_TRANSPORT_ERROR"` = `'HARDWARE_TRANSPORT_ERROR'`

Transport/communication error

### TIMEOUT

> `readonly` **TIMEOUT**: `"HARDWARE_TIMEOUT"` = `'HARDWARE_TIMEOUT'`

Timeout waiting for device

### UNSUPPORTED

> `readonly` **UNSUPPORTED**: `"HARDWARE_UNSUPPORTED"` = `'HARDWARE_UNSUPPORTED'`

Unsupported operation

### INVALID\_PATH

> `readonly` **INVALID\_PATH**: `"HARDWARE_INVALID_PATH"` = `'HARDWARE_INVALID_PATH'`

Invalid derivation path
