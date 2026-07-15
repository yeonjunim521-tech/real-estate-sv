import type { ResolvedTransactionRequest } from "./rent-endpoints"
import { normalizeRentResponse } from "./rent-normalizer"

function assertNever(value: never): never {
  throw new TypeError(`Unexpected transaction mode: ${String(value)}`)
}

export async function transformTransactionResponse(
  resolvedRequest: ResolvedTransactionRequest,
  response: Response,
): Promise<Response> {
  switch (resolvedRequest.mode) {
    case "trade":
      return response
    case "rent":
      return normalizeRentResponse(resolvedRequest.propertyType, response)
    default:
      return assertNever(resolvedRequest)
  }
}
