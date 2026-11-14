# QRaksha-Kavach — Viva Defense Notes & Comprehensive Q&A

This document prepares project team members for viva examination, architectural defense, and technical walkthroughs, addressing the six core evaluation questions outlined in `SPEC.md` Section 11.

---

## 1. Why not ScamDekho or Existing Payment Apps (GPay, PhonePe, Paytm)?

### The Core Gap
Existing UPI applications answer only one narrow question: **"Does this VPA exist and can it receive funds?"**
- If a fraudster pastes their own printed QR sticker over a shopkeeper's counter standee, the UPI app sees a valid VPA and completes the payment.
- If a scammer uses a lookalike handle like `sbi.helpdesk@okaxis`, the UPI app displays the VPA without detecting the brand impersonation.
- Third-party scam checkers like *ScamDekho* operate in silos: they analyze isolated text messages or domain names, but have **zero connection** to the physical counter or payment destination.

### QRaksha-Kavach Differentiation
1. **Physical Counter Binding**: Uses a pure Python Haversine calculation ($R = 6,371 \text{ km}$) to verify that the scanned QR matches the registered merchant at that exact shop ($\le 100\text{ m}$).
2. **Proactive Merchant Alerting**: When a customer scans a swapped sticker at a counter, the shopkeeper's dashboard is alerted within seconds, enabling immediate physical removal of the malicious sticker.
3. **Cross-Channel Story Linking**: Correlates payment destinations with previously reported scam content. If an extortion SMS (e.g. "CBI Digital Arrest") contains a UPI ID, any future QR code matching that ID triggers instant DANGER citing the report.
4. **Offline Resilience & Zero Hallucination**: Predefined safety instructions are loaded from `explanations.yaml`. Detectors operate with 100% functionality even when offline (`LLM_OFFLINE=1`).

---

## 2. How Does the Merchant Registry Get Adopted in Practice?

### Realistic Pilot Rollout
We do **not** claim instantaneous national coverage or require an impossible nationwide database overhaul:
1. **Pilot Deployment via PSPs / Banks**: Rolled out as an opt-in merchant security pilot in partnership with local merchant associations (e.g. Hyderabad Kirana Merchants Association), regional rural banks (e.g. Andhra Pradesh Grameena Vikas Bank), or payment service providers (PSPs).
2. **Simple Onboarding**: A merchant enters their shop name, category, and counter UPI ID once via `/api/merchant/register`. The app captures a coarse coordinate snapshot (~111m grid) and assigns a permanent shop code (`KIR-0001`).
3. **Demonstration Scope**: Our pilot simulates 20 synthetic kirana shops in a 3 km bounding box in Charminar, Hyderabad (`17.3850, 78.4867`). If expanded, regional clusters onboard independently.

---

## 3. What if GPS is Inaccurate, Spoofed, or Disabled?

### Multi-Tiered Graceful Fallback
GPS coordinates can drift indoors, be blocked by concrete roofs, or be denied by privacy-conscious users. QRaksha-Kavach handles this deterministically:
1. **Location is Only Supporting Evidence**: Proximity is never treated as positive proof of merchant identity. It only serves to detect sticker swaps when on-premise.
2. **Safe Fallback to UNVERIFIED (Never SAFE)**: If GPS coordinates are unavailable or the scan occurs far from any registered merchant, the app outputs **`UNVERIFIED`**, stating:
   > *"No registry data for this location. Verify recipient details directly before paying."*
   The system **never** gives a false sense of security by saying "SAFE" when data is absent.
3. **Manual Shop Code Fallback**: Every registered merchant receives a visible 4-digit code (e.g. `KIR-0015`) on their standee. A customer with GPS disabled can simply type this code into the app. The registry checks the entered code against the scanned UPI ID without requiring any location permission.
4. **Crowd Drift as Second Line of Defense**: At unregistered spots (e.g. a roadside tea stall), the crowd baseline detector tracks historical scans. If a dominant payee has $\ge 70\%$ share across $\ge 8$ scans and a new payee suddenly appears, the app outputs **`CAUTION`**.

---

## 4. What Exactly is the Role of the LLM?

### Centralized, Strictly Bounded Role
Unlike fragile chatbot solutions that ask an LLM to "decide if this is safe," QRaksha-Kavach enforces strict boundaries via `backend/app/llm.py`:
1. **Dual-Layer Text Classification Only**: The LLM is used strictly to extract evidence spans and identify semantic nuances in free-form messages.
2. **Zero Dynamic Safety Advice**: The LLM is **strictly forbidden** from generating user-facing advice or instructions. All safety advice, warnings, and next steps are loaded exclusively from predefined entries in `backend/app/config/explanations.yaml`.
3. **Deterministic Parameters**: When online, the LLM runs with `temperature = 0`, an aggressive `8-second timeout`, and an SQLite response cache keyed by `SHA-256(text)` to avoid duplicate latency and cost.
4. **100% Rules-Only Fallback**: If the internet drops or `LLM_OFFLINE=1` is set, the system falls back seamlessly to its deterministic 11-category rule engine ($1 - \prod(1 - w_i)$), maintaining 95% accuracy on held-out scam messages.

---

## 5. How is User Privacy and Data Protected?

### Strict Constitutional Guardrails (AGENTS.md & SPEC.md Section 17)
1. **Zero Credential Collection**: The system never prompts for, collects, transmits, or stores UPI PINs, OTPs, CVVs, passwords, or bank account credentials.
2. **Coarse Location Grid Only**: GPS coordinates are permanently rounded to 3 decimal places (~111 meters) before storage. Exact meter coordinates and continuous tracking trails are never recorded.
3. **Synthetic Demonstration Data**: All 20 merchants, 50 messages, 30 scan scenarios, and 6 APK samples use realistic synthetic data. Zero real customer or merchant PII is used.
4. **Static APK Triage (No Binary Execution)**: Android APK analysis operates exclusively on static metadata JSON (`file_name`, `package_name`, `permissions`, `source`). Untrusted APK binaries are **never downloaded, installed, or dynamically executed**.

---

## 6. Which Parts Did AI Write? (Academic & Project Transparency)

### Explicit Division of Responsibility
In accordance with AI disclosure best practices:

| Component | AI Role (Antigravity Assistant) | Human / Specification Governance |
| :--- | :--- | :--- |
| **Architecture & SPEC** | Assisted in formatting and cross-referencing. | Designed by project team based on RBI/NPCI fraud trends and Andhra Pradesh/Telangana ground realities. |
| **Detector Code** | Scaffolding and boilerplates based on SPEC Section 6. | Algorithmic logic (Haversine formula, RapidFuzz thresholds, independence probability formula $1 - \prod(1 - w_i)$) strictly governed by SPEC constraints. |
| **Safety Explanations** | Formatting YAML dictionary structure. | **Zero AI generation.** Every sentence in `explanations.yaml` is predefined and reviewed for elderly accessibility. |
| **Test Suite** | Generating 156 comprehensive pytest unit and integration test cases. | Every table row and scenario count dictated exactly by SPEC Sections 6.1–6.9, 8.2, and 11. |
| **Frontend PWA** | Component scaffolding (Vite + React + Tailwind CSS). | Strict aesthetic guidelines: warm paper palette (`#F6F4EE`), flat 2px borders, terracotta buttons, $\ge 18\text{px}$ text, no glossy corporate styles. |
