export function resolveTransactionLocation(item) {
    const jibun = String(item.jibun || '').trim();
    if (!jibun) return { jibun: '', confidence: '주소 정보 부족 · 확인 필요' };
    if (jibun.includes('*')) return { jibun, confidence: '지번 마스킹 · 확인 필요' };
    return { jibun, confidence: '원천 거래 확인' };
}
