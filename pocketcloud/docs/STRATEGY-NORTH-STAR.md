# Pocket Cloud — North Star Strategy: The Embedded Home-Edge Play

> **Status: STANDING STRATEGIC DIRECTION (DR-09).** This document exists so
> the long game is never lost in the milestone grind. Every roadmap review
> checks against it. It is deliberately ambitious and deliberately honest
> about difficulty.

## 1. Origin and the north star

The founding concept predates this company: a pitch inside AWS to turn Alexa
home devices into smart internet routers — providing network security to
homes and moving traffic through AWS's backbone. It never made it past team
alignment there. Pocket Cloud is the independent, provider-neutral version
of that conviction:

> **North star:** Pocket Cloud's runtime embedded in the home's edge devices
> — routers, mesh Wi-Fi nodes, set-top boxes, NAS, and eventually voice
> assistants — making every home a secure, monetizable edge node: idle
> compute rented into the fabric, and (as a bundled product surface) network
> security value delivered back to the household.

The home gateway is the *perfect* Pocket Cloud host: wall-powered and always
on, Linux-based, network-positioned, owned by the household, and shipped in
the hundreds of millions. Solving embedded distribution is the
billions-of-devices unlock (DEVICE-RUNTIME.md Addendum A.4) — and the
router/gateway class is where to start, not the phone.

## 2. The competitive clock (why sequencing is the strategy)

**A hyperscaler can reproduce our solution.** AWS in particular has the
devices (Echo, eero), the backbone, and the original internal concept.
Therefore:

1. **Speed to embedded first-mover.** Sign OEMs before the giants care.
   Every device shipping with our runtime is supply they'd have to displace
   rather than merely match.
2. **Neutrality is our structural moat.** An OEM that embeds AWS's fabric
   strengthens AWS — its cloud competitor, its retail competitor, and (for
   router vendors) the owner of eero. We are the partner that doesn't
   compete with any OEM. Hyperscalers cannot copy neutrality.
3. **Liquidity compounds.** The fabric's value is a two-sided network
   (verified supply + paying demand + the trust/metering spine). A copied
   runtime without the marketplace is an empty pipe.
4. **The giants become the endgame, not the entry.** Approach Amazon/Google
   only from strength — a shipped OEM footprint, proven payout/showback
   economics, and enterprise references — as a "we bring your idle fleet
   revenue" partnership, on our terms. Going to them first hands them the
   blueprint with no leverage.

## 3. Partner sequencing (smaller players first — they're interested *now*)

| Wave | Targets (class, examples) | Why they say yes |
|---|---|---|
| **P-0 (proof)** | Our own MSP channel: managed-client fleets, NAS (Synology/QNAP packages), OpenWrt-class routers (GL.iNet, Turris) | Existing relationships; HA-016 code path already planned; produces the reference metrics |
| **P-1 (embedded beachhead)** | Indie/challenger router + mesh vendors; smart-home hub makers; Home Assistant ecosystem | Hardware-margin businesses hungry for recurring revenue; a rev-share turns every shipped unit into an annuity; small enough to move in one quarter |
| **P-2 (scale carriers)** | ISP CPE / managed-Wi-Fi providers (the Plume/Airties analog: SaaS riding on ISP-deployed gateways) | ISPs monetize deployed fleets and can bundle "home network security + earn-back" in the broadband bill; one deal = millions of devices |
| **P-3 (endgame)** | Consumer-electronics giants and voice-assistant platforms (Amazon/Alexa, Google) | Approached from a shipped footprint; their alternative is displacing an installed, neutral standard |

**OEM offer shape:** the embedded SDK (same small Rust core; no privileged
requirements; owner-consent, resource-cap, and transparency hooks exposed to
the OEM's own UI) + revenue share on fabric earnings + optionally the
white-labeled network-security bundle (§4). The OEM's shipped fleet becomes
a monetizable asset with a firmware update.

## 4. The security-bundle option (the other half of the original pitch)

The AWS pitch paired compute with **home network security**. For us this is
a distinct, optional product surface — kept strictly separate from the
compute fabric's privacy posture:

- The compute fabric never inspects traffic; content-blindness (DR-01/
  DR-SEC-01) is untouchable.
- A gateway partner MAY bundle an explicit, owner-consented security service
  (DNS filtering, threat-feed blocking, IoT segmentation) as household value
  alongside earnings — this is PDC's MSSP DNA productized for homes, and it
  gives OEMs/ISPs a consumer benefit story beyond "your router earns money."
- If offered, it is a separate opt-in with its own privacy policy — never a
  silent capability of the fabric runtime. (SEC review required before any
  P-1 deal includes it.)

## 5. What this changes about the plan (and what it doesn't)

- **Doesn't change MVP.** DR-PF-04/DR-08 stand: desktop + homelab + private
  enterprise pools first — they produce the revenue, the payout engine, and
  the reference metrics every OEM conversation needs.
- **Does change design bias, starting now:** the agent core stays small,
  cross-compilable, and privilege-free (embeddability is a standing
  requirement, not a retrofit — FT-03 already specifies the Rust core +
  kernels-as-data shape that makes this true); the enrollment/policy schema
  must support an OEM acting as fleet operator (HA-011's org model
  generalizes); metering/showback must support rev-share splits (MB ledger
  already double-entry — add a party, not a redesign).
- **Owner:** founder. Reviewed at every milestone close ("are we closer to
  P-1?"). First concrete artifact: an OEM-facing one-pager + SDK surface
  sketch, gated on MVP exit (tracked as HA-018).

## 6. Honest difficulty register

OEM cycles are 6–18 months; embedded support is a real cost (firmware
diversity, recall risk); rev-share accounting needs per-party ledger lines;
consumer consent UX on someone else's device is delicate; a giant may still
bundle a clone for free (mitigations: §2 — speed, neutrality, liquidity).
Difficult is acceptable. Forgotten is not.

## Change log
- 2026-07-03: created from founder direction; ratified as DR-09.
