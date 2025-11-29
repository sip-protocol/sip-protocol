[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ProposalStatus

# Variable: ProposalStatus

> `const` **ProposalStatus**: `object`

Defined in: packages/types/dist/index.d.ts:1561

Proposal status

## Type Declaration

### PENDING

> `readonly` **PENDING**: `"pending"`

Proposal created, awaiting signatures

### APPROVED

> `readonly` **APPROVED**: `"approved"`

Has enough signatures, ready to execute

### EXECUTED

> `readonly` **EXECUTED**: `"executed"`

Successfully executed

### REJECTED

> `readonly` **REJECTED**: `"rejected"`

Rejected by signers

### EXPIRED

> `readonly` **EXPIRED**: `"expired"`

Expired before execution

### CANCELLED

> `readonly` **CANCELLED**: `"cancelled"`

Cancelled by proposer
