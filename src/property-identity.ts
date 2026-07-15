import { buildPnu } from "./pnu"
import type { PnuInput, PnuResult, PnuValue } from "./pnu"
import type { PropertyType } from "./transaction-query"

type PropertyIdentityInput = PnuInput & {
  readonly propertyType: Exclude<PropertyType, "land" | "right">
  readonly buildingName: string
  readonly buildingRegistryId?: string
}

type LandIdentity = {
  readonly kind: "land"
  readonly key: string
  readonly pnu: string
  readonly location: PnuValue
}

type BuildingIdentity = {
  readonly kind: "building"
  readonly key: string
  readonly landKey: string
  readonly propertyType: PropertyIdentityInput["propertyType"]
  readonly name: string
  readonly registryId: string | null
}

type PnuInvalidResult = Extract<PnuResult, { readonly kind: "invalid" }>

export type PropertyIdentityResult =
  | PnuInvalidResult
  | { readonly kind: "invalid"; readonly reason: "invalid-building-name" }
  | {
      readonly kind: "valid"
      readonly land: LandIdentity
      readonly building: BuildingIdentity
    }

export type PropertyIdentityIssue =
  | {
      readonly kind: "duplicate-building-name"
      readonly buildingName: string
      readonly landKeys: readonly string[]
    }
  | {
      readonly kind: "address-change"
      readonly buildingRegistryId: string
      readonly landKeys: readonly string[]
    }

export function createPropertyIdentity(input: PropertyIdentityInput): PropertyIdentityResult {
  const pnuResult = buildPnu(input)
  if (pnuResult.kind === "invalid") return pnuResult
  const name = input.buildingName.trim().replace(/\s+/g, " ")
  if (name.length === 0) return { kind: "invalid", reason: "invalid-building-name" }
  const registryId = input.buildingRegistryId?.trim() || null
  const buildingKey = registryId
    ? `registry:${registryId}`
    : `land:${pnuResult.value.pnu}:${input.propertyType}:${encodeURIComponent(name.toLocaleLowerCase("ko-KR"))}`
  return {
    kind: "valid",
    land: {
      kind: "land",
      key: pnuResult.value.pnu,
      pnu: pnuResult.value.pnu,
      location: pnuResult.value,
    },
    building: {
      kind: "building",
      key: buildingKey,
      landKey: pnuResult.value.pnu,
      propertyType: input.propertyType,
      name,
      registryId,
    },
  }
}

type IdentityGroup = {
  readonly label: string
  readonly landKeys: string[]
}

type IdentityGroupEntry = {
  readonly key: string
  readonly label: string
  readonly landKey: string
}

function addToGroup(groups: Map<string, IdentityGroup>, entry: IdentityGroupEntry): void {
  const existing = groups.get(entry.key)
  if (existing) {
    if (!existing.landKeys.includes(entry.landKey)) existing.landKeys.push(entry.landKey)
    return
  }
  groups.set(entry.key, { label: entry.label, landKeys: [entry.landKey] })
}

export function findPropertyIdentityIssues(
  identities: readonly PropertyIdentityResult[],
): readonly PropertyIdentityIssue[] {
  const names = new Map<string, IdentityGroup>()
  const registries = new Map<string, IdentityGroup>()
  for (const identity of identities) {
    if (identity.kind === "invalid") continue
    addToGroup(names, {
      key: identity.building.name.toLocaleLowerCase("ko-KR"),
      label: identity.building.name,
      landKey: identity.land.key,
    })
    if (identity.building.registryId) {
      addToGroup(registries, {
        key: identity.building.registryId,
        label: identity.building.registryId,
        landKey: identity.land.key,
      })
    }
  }

  const issues: PropertyIdentityIssue[] = []
  for (const group of names.values()) {
    if (group.landKeys.length > 1) {
      issues.push({
        kind: "duplicate-building-name",
        buildingName: group.label,
        landKeys: group.landKeys,
      })
    }
  }
  for (const group of registries.values()) {
    if (group.landKeys.length > 1) {
      issues.push({
        kind: "address-change",
        buildingRegistryId: group.label,
        landKeys: group.landKeys,
      })
    }
  }
  return issues
}
