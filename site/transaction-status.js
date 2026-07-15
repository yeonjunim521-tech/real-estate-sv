export function resolveTransactionStatus(item) {
  const firstNonBlank = values => {
    for (const value of values) {
      const normalized = String(value ?? '').trim()
      if (normalized) return normalized
    }
    return ''
  }

  const cancelType = firstNonBlank([item.cdealType, item.cancelDealType])
  const cancelDate = firstNonBlank([item.cdealDay, item.cancelDealDay, item.cancelDate])
  return {
    cancelled: Boolean(cancelType || cancelDate),
    cancelDate,
  }
}
