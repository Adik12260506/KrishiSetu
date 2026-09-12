/**
 * Independent Rainfall Oracle Providers
 * Source A: AWS_IMD_MANDAL (IMD Ground Automated Weather Station)
 * Source B: SATELLITE_GPM_GRID (NASA GPM / CHIRPS Gridded Satellite)
 * Source C: PANCHAYAT_IOT_GUAGE (Gram Panchayat IoT Rain Gauge)
 */

class RainfallOracleProvider {
  constructor() {
    this.overrides = {};
  }

  setOverride(sourceId, overrideData) {
    this.overrides[sourceId] = overrideData;
  }

  clearOverrides() {
    this.overrides = {};
  }

  getObservations(region, baselineRainfallMm = 18.5, nowIso = new Date().toISOString()) {
    const nowMs = new Date(nowIso).getTime();

    const sources = [
      {
        source_id: 'AWS_IMD_MANDAL',
        name: 'IMD Automated Ground Weather Station',
        type: 'GROUND_AWS',
        region: region || 'Anantapur / Rayalaseema',
        rainfall_mm: baselineRainfallMm,
        observation_timestamp: nowIso,
        received_timestamp: nowIso,
        confidence: 0.95,
        signature: `sig_imd_${sourceHash('AWS_IMD_MANDAL', baselineRainfallMm, nowIso)}`,
        status: 'ONLINE'
      },
      {
        source_id: 'SATELLITE_GPM_GRID',
        name: 'NASA GPM / CHIRPS Satellite Grid',
        type: 'SATELLITE',
        region: region || 'Anantapur / Rayalaseema',
        rainfall_mm: baselineRainfallMm + 1.2, // normal micro-variation
        observation_timestamp: new Date(nowMs - 5 * 60 * 1000).toISOString(),
        received_timestamp: nowIso,
        confidence: 0.90,
        signature: `sig_gpm_${sourceHash('SATELLITE_GPM_GRID', baselineRainfallMm + 1.2, nowIso)}`,
        status: 'ONLINE'
      },
      {
        source_id: 'PANCHAYAT_IOT_GUAGE',
        name: 'Gram Panchayat Digital Rain Gauge',
        type: 'LOCAL_IOT',
        region: region || 'Anantapur / Rayalaseema',
        rainfall_mm: Math.max(0, baselineRainfallMm - 0.8), // normal local variation
        observation_timestamp: new Date(nowMs - 2 * 60 * 1000).toISOString(),
        received_timestamp: nowIso,
        confidence: 0.85,
        signature: `sig_iot_${sourceHash('PANCHAYAT_IOT_GUAGE', baselineRainfallMm - 0.8, nowIso)}`,
        status: 'ONLINE'
      }
    ];

    // Apply any test or chaos overrides
    return sources.map(src => {
      if (this.overrides[src.source_id]) {
        return { ...src, ...this.overrides[src.source_id] };
      }
      return src;
    });
  }
}

function sourceHash(sourceId, val, ts) {
  let hash = 0;
  const str = `${sourceId}:${val}:${ts}`;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

const globalOracleProvider = new RainfallOracleProvider();

module.exports = {
  RainfallOracleProvider,
  globalOracleProvider
};
