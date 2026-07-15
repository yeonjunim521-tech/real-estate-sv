export function isAnalysisReady({ sidoCd, lawdCd, dealYmd, selectedTypes }) {
    return Boolean(sidoCd && lawdCd && dealYmd && selectedTypes.length);
}
