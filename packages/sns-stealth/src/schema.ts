import { z } from 'zod'

const Hex32 = z.string().regex(/^[0-9a-f]{64}$/)

export const SIPStealthRecordV1 = z.object({
  v: z.literal(1),
  spending: Hex32,
  viewing: Hex32,
})

export type SIPStealthRecord = z.infer<typeof SIPStealthRecordV1>

export type ParseResult =
  | { ok: true; data: SIPStealthRecord }
  | { ok: false; reason: 'json-parse'; error: unknown }
  | { ok: false; reason: 'schema'; error: z.ZodError }

export function parseRecord(raw: string): ParseResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { ok: false, reason: 'json-parse', error }
  }

  const result = SIPStealthRecordV1.safeParse(parsed)
  if (!result.success) {
    return { ok: false, reason: 'schema', error: result.error }
  }
  return { ok: true, data: result.data }
}

export function encodeRecord(record: SIPStealthRecord): string {
  // Canonical JSON: stable key order, no whitespace.
  return JSON.stringify({
    v: record.v,
    spending: record.spending,
    viewing: record.viewing,
  })
}
