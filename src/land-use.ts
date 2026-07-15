export type LandUseResult =
  | {
      readonly kind: "normalized"
      readonly value: {
        readonly source: "molit-land-use"
        readonly landKey: string
        readonly pnu: string
        readonly zone: { readonly code: string; readonly name: string }
        readonly restriction: { readonly code: string; readonly name: string } | null
        readonly sourceUpdatedOn: string | null
      }
    }
  | { readonly kind: "rejected"; readonly reason: "invalid-record" }

function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function compactDate(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === "") return null
  const date = text(value)
  if (!date || !/^\d{8}$/.test(date)) return undefined
  const parsed = new Date(`${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10).replaceAll("-", "") !== date) {
    return undefined
  }
  return parsed.toISOString().slice(0, 10)
}

export function normalizeLandUse(item: Readonly<Record<string, unknown>>): LandUseResult {
  const pnu = text(item.pnu)
  const zoneCode = text(item.prposAreaDstrcCode)
  const zoneName = text(item.prposAreaDstrcCodeNm)
  const restrictionCode = text(item.regstrSeCode)
  const restrictionName = text(item.regstrSeCodeNm)
  const sourceUpdatedOn = compactDate(item.lastUpdtDt)
  if (
    !pnu ||
    !/^\d{19}$/.test(pnu) ||
    !zoneCode ||
    !zoneName ||
    sourceUpdatedOn === undefined ||
    Boolean(restrictionCode) !== Boolean(restrictionName)
  ) {
    return { kind: "rejected", reason: "invalid-record" }
  }
  return {
    kind: "normalized",
    value: {
      source: "molit-land-use",
      landKey: pnu,
      pnu,
      zone: { code: zoneCode, name: zoneName },
      restriction:
        restrictionCode && restrictionName
          ? { code: restrictionCode, name: restrictionName }
          : null,
      sourceUpdatedOn,
    },
  }
}
