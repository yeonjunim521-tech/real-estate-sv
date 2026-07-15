export function isAnalysisReady({ sidoCd, lawdCd, dealYmd, selectedTypes, dong }) {
    return Boolean(sidoCd && lawdCd && dealYmd && selectedTypes.length && dong);
}
