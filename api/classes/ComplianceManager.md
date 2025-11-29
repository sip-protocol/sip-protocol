[**SIP Protocol API v0.1.0**](../README.md)

***

[SIP Protocol API](../README.md) / ComplianceManager

# Class: ComplianceManager

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:84](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L84)

ComplianceManager - Enterprise compliance and auditing

## Accessors

### organizationId

#### Get Signature

> **get** **organizationId**(): `string`

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:148](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L148)

##### Returns

`string`

***

### organizationName

#### Get Signature

> **get** **organizationName**(): `string`

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:152](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L152)

##### Returns

`string`

***

### masterViewingKey

#### Get Signature

> **get** **masterViewingKey**(): [`ViewingKey`](../interfaces/ViewingKey.md)

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:156](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L156)

##### Returns

[`ViewingKey`](../interfaces/ViewingKey.md)

## Methods

### create()

> `static` **create**(`params`): `Promise`\<`ComplianceManager`\>

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:99](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L99)

Create a new compliance manager

#### Parameters

##### params

[`CreateComplianceConfigParams`](../interfaces/CreateComplianceConfigParams.md)

#### Returns

`Promise`\<`ComplianceManager`\>

***

### fromConfig()

> `static` **fromConfig**(`config`): `ComplianceManager`

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:142](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L142)

Load from existing config

#### Parameters

##### config

[`ComplianceConfig`](../interfaces/ComplianceConfig.md)

#### Returns

`ComplianceManager`

***

### getConfig()

> **getConfig**(): [`ComplianceConfig`](../interfaces/ComplianceConfig.md)

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:160](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L160)

#### Returns

[`ComplianceConfig`](../interfaces/ComplianceConfig.md)

***

### registerAuditor()

> **registerAuditor**(`params`, `registeredBy`): `Promise`\<[`AuditorRegistration`](../interfaces/AuditorRegistration.md)\>

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:169](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L169)

Register a new auditor

#### Parameters

##### params

[`RegisterAuditorParams`](../interfaces/RegisterAuditorParams.md)

##### registeredBy

`string`

#### Returns

`Promise`\<[`AuditorRegistration`](../interfaces/AuditorRegistration.md)\>

***

### getAuditor()

> **getAuditor**(`auditorId`): [`AuditorRegistration`](../interfaces/AuditorRegistration.md) \| `undefined`

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:213](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L213)

Get an auditor by ID

#### Parameters

##### auditorId

`string`

#### Returns

[`AuditorRegistration`](../interfaces/AuditorRegistration.md) \| `undefined`

***

### getAllAuditors()

> **getAllAuditors**(): [`AuditorRegistration`](../interfaces/AuditorRegistration.md)[]

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:220](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L220)

Get all auditors

#### Returns

[`AuditorRegistration`](../interfaces/AuditorRegistration.md)[]

***

### getActiveAuditors()

> **getActiveAuditors**(): [`AuditorRegistration`](../interfaces/AuditorRegistration.md)[]

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:227](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L227)

Get active auditors

#### Returns

[`AuditorRegistration`](../interfaces/AuditorRegistration.md)[]

***

### deactivateAuditor()

> **deactivateAuditor**(`auditorId`, `deactivatedBy`, `reason`): [`AuditorRegistration`](../interfaces/AuditorRegistration.md)

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:234](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L234)

Deactivate an auditor

#### Parameters

##### auditorId

`string`

##### deactivatedBy

`string`

##### reason

`string`

#### Returns

[`AuditorRegistration`](../interfaces/AuditorRegistration.md)

***

### updateAuditorScope()

> **updateAuditorScope**(`auditorId`, `scope`, `updatedBy`): [`AuditorRegistration`](../interfaces/AuditorRegistration.md)

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:264](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L264)

Update auditor scope

#### Parameters

##### auditorId

`string`

##### scope

[`AuditScope`](../interfaces/AuditScope.md)

##### updatedBy

`string`

#### Returns

[`AuditorRegistration`](../interfaces/AuditorRegistration.md)

***

### discloseTransaction()

> **discloseTransaction**(`payment`, `auditorId`, `viewingKey`, `disclosedBy`, `additionalInfo?`): [`DisclosedTransaction`](../interfaces/DisclosedTransaction.md)

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:301](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L301)

Disclose a transaction to an auditor

#### Parameters

##### payment

[`ShieldedPayment`](../interfaces/ShieldedPayment.md)

The shielded payment to disclose

##### auditorId

`string`

The auditor to disclose to

##### viewingKey

[`ViewingKey`](../interfaces/ViewingKey.md)

The viewing key to decrypt the payment

##### disclosedBy

`string`

Who authorized the disclosure

##### additionalInfo?

###### txHash?

`string`

###### blockNumber?

`number`

###### riskScore?

`number`

###### riskFlags?

`string`[]

###### notes?

`string`

###### tags?

`string`[]

#### Returns

[`DisclosedTransaction`](../interfaces/DisclosedTransaction.md)

The disclosed transaction

***

### getDisclosedTransactions()

> **getDisclosedTransactions**(`auditorId?`): [`DisclosedTransaction`](../interfaces/DisclosedTransaction.md)[]

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:402](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L402)

Get disclosed transactions for an auditor

#### Parameters

##### auditorId?

`string`

#### Returns

[`DisclosedTransaction`](../interfaces/DisclosedTransaction.md)[]

***

### getDisclosedTransaction()

> **getDisclosedTransaction**(`disclosureId`): [`DisclosedTransaction`](../interfaces/DisclosedTransaction.md) \| `undefined`

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:413](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L413)

Get a disclosed transaction by ID

#### Parameters

##### disclosureId

`string`

#### Returns

[`DisclosedTransaction`](../interfaces/DisclosedTransaction.md) \| `undefined`

***

### createDisclosureRequest()

> **createDisclosureRequest**(`transactionId`, `auditorId`, `reason`): [`DisclosureRequest`](../interfaces/DisclosureRequest.md)

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:422](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L422)

Create a disclosure request

#### Parameters

##### transactionId

`string`

##### auditorId

`string`

##### reason

`string`

#### Returns

[`DisclosureRequest`](../interfaces/DisclosureRequest.md)

***

### approveDisclosureRequest()

> **approveDisclosureRequest**(`requestId`, `approvedBy`): [`DisclosureRequest`](../interfaces/DisclosureRequest.md)

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:463](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L463)

Approve a disclosure request

#### Parameters

##### requestId

`string`

##### approvedBy

`string`

#### Returns

[`DisclosureRequest`](../interfaces/DisclosureRequest.md)

***

### denyDisclosureRequest()

> **denyDisclosureRequest**(`requestId`, `deniedBy`, `reason`): [`DisclosureRequest`](../interfaces/DisclosureRequest.md)

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:490](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L490)

Deny a disclosure request

#### Parameters

##### requestId

`string`

##### deniedBy

`string`

##### reason

`string`

#### Returns

[`DisclosureRequest`](../interfaces/DisclosureRequest.md)

***

### getPendingRequests()

> **getPendingRequests**(): [`DisclosureRequest`](../interfaces/DisclosureRequest.md)[]

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:523](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L523)

Get pending disclosure requests

#### Returns

[`DisclosureRequest`](../interfaces/DisclosureRequest.md)[]

***

### generateReport()

> **generateReport**(`params`, `requestedBy`): `Promise`\<[`ComplianceReport`](../interfaces/ComplianceReport.md)\>

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:533](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L533)

Generate a compliance report

#### Parameters

##### params

[`GenerateReportParams`](../interfaces/GenerateReportParams.md)

##### requestedBy

`string`

#### Returns

`Promise`\<[`ComplianceReport`](../interfaces/ComplianceReport.md)\>

***

### getReport()

> **getReport**(`reportId`): [`ComplianceReport`](../interfaces/ComplianceReport.md) \| `undefined`

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:602](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L602)

Get a report by ID

#### Parameters

##### reportId

`string`

#### Returns

[`ComplianceReport`](../interfaces/ComplianceReport.md) \| `undefined`

***

### getAllReports()

> **getAllReports**(): [`ComplianceReport`](../interfaces/ComplianceReport.md)[]

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:609](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L609)

Get all reports

#### Returns

[`ComplianceReport`](../interfaces/ComplianceReport.md)[]

***

### getAuditLog()

> **getAuditLog**(`options?`): [`AuditLogEntry`](../interfaces/AuditLogEntry.md)[]

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:618](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L618)

Get audit log entries

#### Parameters

##### options?

###### startDate?

`number`

###### endDate?

`number`

###### actor?

`string`

###### action?

`"auditor_registered"` \| `"auditor_deactivated"` \| `"transaction_disclosed"` \| `"report_generated"` \| `"disclosure_requested"` \| `"disclosure_approved"` \| `"disclosure_denied"` \| `"config_updated"`

###### limit?

`number`

#### Returns

[`AuditLogEntry`](../interfaces/AuditLogEntry.md)[]

***

### exportToCSV()

> **exportToCSV**(`auditorId?`): `string`

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:651](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L651)

Export transactions to CSV

#### Parameters

##### auditorId?

`string`

#### Returns

`string`

***

### exportToJSON()

> **exportToJSON**(`auditorId?`): `string`

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:659](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L659)

Export transactions to JSON

#### Parameters

##### auditorId?

`string`

#### Returns

`string`

***

### toJSON()

> **toJSON**(): `string`

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:671](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L671)

Serialize to JSON

#### Returns

`string`

***

### fromJSON()

> `static` **fromJSON**(`json`): `ComplianceManager`

Defined in: [packages/sdk/src/compliance/compliance-manager.ts:685](https://github.com/sip-protocol/sip-protocol/blob/b58f289745cddccf84eff084cb12117a5d2022b5/packages/sdk/src/compliance/compliance-manager.ts#L685)

Deserialize from JSON

#### Parameters

##### json

`string`

#### Returns

`ComplianceManager`
