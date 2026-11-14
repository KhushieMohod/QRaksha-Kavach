# QRaksha-Kavach System Architecture

QRaksha-Kavach ("Check Before You Pay") is an accessible Progressive Web Application (PWA) designed for small merchants, elderly users, and first-time smartphone users in Andhra Pradesh and Telangana.

The system connects suspicious digital content (SMS scams, chat lures, screenshots, voice notes, and APK metadata) with physical and digital payment destinations (UPI QR codes and VPAs) to produce **one unified, deterministic safety verdict**.

---

## 1. High-Level System Architecture

```mermaid
flowchart TD
    subgraph Client["Frontend Client (PWA)"]
        UI["React 18 + Vite + Tailwind CSS"]
        Cam["html5-qrcode (Camera Scanner)"]
        TTS["Speech Synthesis / Pre-recorded Telugu Audio"]
        Cache["PWA Service Worker & Offline Cache"]
    end

    subgraph API["Backend API Gateway (FastAPI)"]
        QRRoute["POST /api/check/qr"]
        TextRoute["POST /api/check/text"]
        ImgRoute["POST /api/check/image"]
        VoiceRoute["POST /api/check/voice"]
        APKRoute["POST /api/check/apk-meta"]
        MerchRoute["POST /api/merchant/register<br/>GET /api/merchant/:id/alerts"]
        DemoRoute["POST /api/demo/simulate<br/>GET /api/metrics"]
    end

    subgraph Detectors["Modular Detector Array (Returns Signal)"]
        D1["QR Parser<br/>(qr_parser.py)"]
        D2["Handle Lookalike<br/>(handle_lookalike.py)"]
        D3["Registry Binding<br/>(registry_binding.py)"]
        D4["Crowd Baseline<br/>(crowd_baseline.py)"]
        D5["Scam Text Classifier<br/>(scam_text.py)"]
        D6["OCR Engine<br/>(ocr.py: OpenCV + Tesseract)"]
        D7["Cross-Channel Story Linker<br/>(story_link.py)"]
        D8["APK Metadata Triage<br/>(apk_triage.py)"]
    end

    subgraph Fusion["Hierarchical Risk Fusion (fusion.py)"]
        F1{"Any Danger Signal?"}
        F2{"Any Caution Signal?"}
        F3{"Registry Matched?"}
        F4["Verdict: UNVERIFIED"]
        VDanger["Verdict: DANGER<br/>(Hard rules not averaged)"]
        VCaution["Verdict: CAUTION"]
        VVerified["Verdict: VERIFIED"]
    end

    subgraph Storage["Persistence & Configuration"]
        DB[("SQLite Database<br/>(SQLModel Engine)")]
        Config["YAML Configs<br/>(rules.yaml, thresholds.yaml, explanations.yaml)"]
        LLM["Centralized LLM Bridge<br/>(app/llm.py: temp=0, 8s timeout, SQLite cache)"]
    end

    UI --> API
    API --> Detectors
    Detectors --> Fusion
    Fusion --> F1
    F1 -- Yes --> VDanger
    F1 -- No --> F2
    F2 -- Yes --> VCaution
    F2 -- No --> F3
    F3 -- Yes --> VVerified
    F3 -- No --> F4
    Detectors <--> Storage
    Detectors <--> Config
    D5 <--> LLM
```

---

## 2. Specialized Detection Modules

All detectors strictly return the unified `Signal` object defined in `SPEC.md` Section 4.2 (`severity`: `ok` | `caution` | `danger`, `score`: $0.0 \dots 1.0$, `evidence`: `list[str]`, `explanation_key`: `str`).

| Detector | Module | Input | Responsibility & Algorithm |
| :--- | :--- | :--- | :--- |
| **QR Parser** | `qr_parser.py` | Raw QR string | Validates `upi://pay` scheme, extracts parameters (`pa`, `pn`, `am`, `mc`), checks required fields. |
| **Handle Lookalike** | `handle_lookalike.py` | VPA handle | Validates known PSP suffixes, detects brand impersonation (e.g. `sbi`, `gpay`), leetspeak digit substitution (`0`->`o`), and edit-distance typos with RapidFuzz. |
| **Registry Binding** | `registry_binding.py` | VPA + Coordinates / Shop Code | Computes pure Python Haversine distance ($R = 6,371 \text{ km}$) against registered kirana merchants ($\le 100\text{ m}$). Matches counter VPA or triggers instant DANGER and rate-limited merchant alert. |
| **Crowd Baseline** | `crowd_baseline.py` | VPA + Coarse Coordinates | Groups historical scans in 3-decimal grid cells (~111 m). If $\ge 8$ scans share $\ge 70\%$ dominance and a new payee appears, returns CAUTION (never danger). |
| **Scam Text** | `scam_text.py` | Message text / SMS | Dual-layer classifier: Evaluates 11 weighted categories ($1 - \prod(1 - w_i)$), 6-word negation window, and centralized LLM fallback with offline support. |
| **Image & OCR** | `ocr.py` | Image / Screenshot | Decodes embedded QR codes using headless OpenCV first; falls back to Tesseract OCR with English and Telugu (`eng+tel`) language packs. |
| **Story Linker** | `story_link.py` | VPA / URL + DB Session | Correlates payment destinations with previously reported scam content. Flagged VPAs trigger DANGER with direct citations and report timestamps. |
| **APK Metadata Triage** | `apk_triage.py` | Static JSON metadata | Evaluates app lures (`challan`, `kisan`, `update`), critical permissions (`BIND_ACCESSIBILITY_SERVICE`, `BIND_DEVICE_ADMIN`), and untrusted sideload channels. Never runs binaries. |

---

## 3. Hierarchical Risk Fusion Engine

The fusion engine (`backend/app/fusion.py`) enforces strict priority rules so that hard security signals cannot be diluted or averaged away:

```mermaid
flowchart TD
    Start["Collected Detector Signals"] --> Q1{"Rule 1: Any Danger Signal?<br/>(Swap, Phishing, Story Link, Critical APK)"}
    Q1 -- Yes --> R1["DANGER Verdict<br/>Select explanation from highest-scoring reason"]
    Q1 -- No --> Q2{"Rule 2: Any Caution Signal?<br/>(Lookalike typo, Crowd drift, Sideloaded APK)"}
    Q2 -- Yes --> R2["CAUTION Verdict<br/>Select explanation from highest-scoring caution"]
    Q2 -- No --> Q3{"Rule 3: Registry Binding Match?<br/>(Matches registered merchant at counter)"}
    Q3 -- Yes --> R3["VERIFIED Verdict<br/>Explanation: matches_registry"]
    Q3 -- No --> R4["UNVERIFIED Verdict<br/>Safe fallback: No scam signs found. Not a guarantee."]
```

---

## 4. Centralized LLM Architecture & Offline Resilience

All LLM calls are strictly gated through `backend/app/llm.py` to prevent prompt leakage, unverified safety advice, or external API failures:

```mermaid
sequenceDiagram
    participant Detector as Scam Text Detector
    participant LLMBridge as app/llm.py
    participant Cache as SQLite LLM Cache Table
    participant API as External Gemini / LLM API

    Detector->>LLMBridge: analyze_text(text)
    alt LLM_OFFLINE=1 or API unavailable
        LLMBridge-->>Detector: None (Trigger deterministic rules-only fallback)
    else Online Mode
        LLMBridge->>Cache: Query SHA-256(text)
        alt Cache Hit
            Cache-->>LLMBridge: Cached structured response
            LLMBridge-->>Detector: Parsed spans & categories
        else Cache Miss
            LLMBridge->>API: HTTP POST (temp=0, timeout=8s)
            alt Request Success
                API-->>LLMBridge: Structured JSON
                LLMBridge->>Cache: Store response
                LLMBridge-->>Detector: Parsed spans & categories
            else Timeout or Error (>8s)
                LLMBridge-->>Detector: None (Rules-only fallback)
            end
        end
    end
```

---

## 5. Database Schema & Data Models

Persistence is implemented with SQLModel (SQLite). Exact coordinates, UPI PINs, and authentication secrets are **never** stored.

```mermaid
erDiagram
    Merchant ||--o{ Alert : receives
    Merchant ||--o{ Scan : logs
    
    Merchant {
        int id PK
        string shop_code UK "e.g. KIR-0001"
        string name "Lakshmi Kirana Store"
        string upi_id "lakshmi.kirana@okaxis"
        string category "grocery"
        float coarse_lat "3 decimal places (~111m)"
        float coarse_lng "3 decimal places (~111m)"
        boolean is_active
        datetime created_at
    }

    Scan {
        int id PK
        string upi_id "Scanned VPA"
        float coarse_lat "3 decimal places"
        float coarse_lng "3 decimal places"
        string raw_payload "upi://pay?..."
        string verdict "verified / danger / caution / unverified"
        string pn "Payee name"
        string mc "Merchant code"
        datetime created_at
    }

    Alert {
        int id PK
        int merchant_id FK
        int scan_id FK
        string type "qr_swap / drift"
        string risk_level "danger / caution"
        int count "Burst count"
        boolean seen
        string details_json
        string explanation_key
        datetime created_at
    }

    FlaggedPayee {
        int id PK
        string upi_id UK "Flagged VPA"
        string scam_type "digital_arrest / phishing / etc"
        int report_count
        float risk_score
        string notes
        datetime first_seen
        datetime last_seen
    }

    Message {
        int id PK
        string text_content
        string scam_score
        string detected_categories
        string source
        datetime created_at
    }

    LLMCache {
        int id PK
        string prompt_hash UK "SHA-256"
        string response_json
        datetime created_at
    }
```

---

## 6. Privacy & Safety Commitments

1. **Zero Credential Collection**: The system never prompts for, reads, or stores UPI PINs, OTPs, or net banking passwords.
2. **Coarse Location Grid**: Only coordinates rounded to 3 decimal places (~111 meters) are retained for registry distance and crowd baseline clustering.
3. **Static Metadata Triage Only**: Untrusted APK files are analyzed strictly from static metadata JSON (`file_name`, `package_name`, `permissions`, `source`). Binaries are never executed.
4. **Predefined Explanations**: Safety advice is locked inside `app/config/explanations.yaml`. LLMs are never permitted to generate advice that could mislead vulnerable users.
