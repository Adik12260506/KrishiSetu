# Where This Breaks: Concrete Failure Analysis & Mitigations

An honest and rigorous engineering evaluation requires disclosing where the system's assumptions encounter physical, meteorological, or cryptographic limits. Below are four realistic failure conditions and our architectural mitigations.

---

### Failure Mode 1: Correlated Systematic Bias in Optical & Radar Satellite Grids
- **Mechanism:** During prolonged pre-monsoon dust haze (frequent in Rayalaseema and Thar arid zones) or heavy cirrus cloud blankets without precipitation, infrared and passive microwave satellite precipitation estimation algorithms (e.g. GPM / CHIRPS) can systematically overestimate optical cloud-top moisture while ground soil receives 0mm rain.
- **Why It Causes Incorrect Output:** If the satellite grid reports 42mm (adequate rain) due to aerosol reflection, while ground drought is severe (12mm), an unweighted average could prevent legitimate payout.
- **Architectural Mitigation:**
  - KrishiSetu applies confidence-weighted clustering rather than naive blending. Ground automated weather stations (AWS) carry higher confidence weights ($w_{\text{ground}} = 0.95$ vs $w_{\text{sat}} = 0.90$).
  - When satellite and ground AWS diverge by $> 12\text{mm}$, the system checks Panchayat IoT ground rain gauges as the tie-breaking quorum anchor.

---

### Failure Mode 2: Collusive / Compromised Sensor Majority in a Single Mandal
- **Mechanism:** If an attacker physically compromises or recalibrates 2 local low-cost Panchayat IoT rain gauges within the same mandal to falsely report 0mm rain during normal monsoon conditions.
- **Why It Causes Incorrect Output:** If 2 local sources agree on 0mm, a naive 2-of-3 quorum rule might accept this cluster and trigger fraudulent mass payouts across the village.
- **Architectural Mitigation:**
  - Cross-strata oracle diversity: KrishiSetu enforces that the quorum must span at least two *distinct oracle modalities* (e.g. Satellite Grid + IMD Synoptic Ground Station), preventing local IoT sensor tampering from capturing majority consensus.
  - Anomaly bounding: Readings deviating by $> 3.5\sigma$ from regional historical baselines trigger `FLAGGED_MANIPULATION` audit review.

---

### Failure Mode 3: Handset Hardware RTC Tampering during Multi-Week Offline Blackout
- **Mechanism:** A farmer's cheap feature phone has its hardware real-time clock manually wound forward or backward by 45 days while offline to simulate an expired measurement window.
- **Why It Causes Incorrect Output:** Could attempt to trigger retroactive claims or forge outdated sequence timestamps.
- **Architectural Mitigation:**
  - **Zero Trust in Client Wall-Clock Timestamps:** The offline wallet relies exclusively on a strict **monotonic sequence counter ($S_{\text{client}}$)** and server-assigned anchor timestamps upon synchronization.
  - Server reconciliation validates event sequences against server-side oracle observation validity epochs. Retroactive sequence tampering is rejected by the idempotent ledger.

---

### Failure Mode 4: Hyper-Local Micro-Topography & Rain-Shadow Pockets
- **Mechanism:** In hilly or undulating terrain (e.g., Eastern Ghats foothills), a cloudburst may drop 60mm at the mandal headquarters weather station while a rain-shadow hamlet 8 km away receives only 8mm.
- **Why It Causes Incorrect Output:** The regional weather station records normal rain, denying valid drought claims for farmers in the micro-pocket (basis risk).
- **Architectural Mitigation:**
  - Declarative product customization: Policy engine supports hyper-local gridded polygon thresholds ($1\text{km} \times 1\text{km}$) and village-level Panchayat micro-sensors without needing code redeployment.
  - Dispute audit trail: The reconstruction DAG explicitly records the exact geographic coordinates and sensor IDs used, allowing manual dispute review and post-season basis risk compensation.
