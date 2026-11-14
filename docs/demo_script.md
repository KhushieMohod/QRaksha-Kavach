# QRaksha-Kavach — 4-Minute Live Demonstration Video Script

This script provides a step-by-step presentation script designed for the ~4-minute evaluation video, covering the **four core demonstration beats** from `SPEC.md` Section 11 with **zero manual database edits**.

---

## Video Overview & Timing

| Beat | Topic | Duration | Target Screen |
| :--- | :--- | :--- | :--- |
| **Intro** | Project Mission & Accessibility | 0:00 – 0:30 (30s) | Check Screen |
| **Beat 1** | Physical Counter Binding & Merchant Alert | 0:30 – 1:30 (60s) | Check $\to$ Demo $\to$ Merchant |
| **Beat 2** | Cross-Channel Scam Story Linking | 1:30 – 2:30 (60s) | Demo $\to$ Check $\to$ Result |
| **Beat 3** | Multimodal Defense (Screenshot OCR & APK Triage) | 2:30 – 3:15 (45s) | Check $\to$ Result |
| **Beat 4** | Live Metrics & Architectural Differentiation | 3:15 – 4:00 (45s) | Metrics Screen |

---

## Minute-by-Minute Script

### Introduction (0:00 – 0:30)
- **Visual**: Open PWA at `http://localhost:5173` in a mobile viewport (390×844px). The warm paper background, high-contrast buttons ($\ge 18\text{px}$), and multilingual language toggle (English, తెలుగు, हिंदी) are visible.
- **Presenter (Voiceover)**:
  > *"Namaste! In India's booming UPI ecosystem, small kirana merchants and elderly citizens face sophisticated payment scams: swapped counter QR stickers, fake brand handles, and digital arrest threats. Existing payment apps only ask: 'Does this UPI ID exist?' — they cannot verify if a payment actually belongs to the shop in front of you. This is QRaksha-Kavach: a 'Check Before You Pay' progressive web app that turns any smartphone into an intelligent scam defense shield."*

---

### Beat 1: Counter QR Swap & Instant Merchant Alert (0:30 – 1:30)
- **Visual**: On the **Check** screen, click preset **"KIR-0001 Genuine QR"** (Lakshmi Kirana Store at Charminar). Click **"Check Before You Pay"**.
- **Presenter**:
  > *"First, let's scan a genuine QR at Lakshmi Kirana Store. Notice the instant result: a bold green VERIFIED badge confirming that the payee lakshmi.kirana@okaxis matches the physical counter registry at this location. Even better, users can tap 'Listen' to hear spoken safety instructions in Telugu or Hindi."*
- **Visual**: Switch to the **Demo Panel** screen. Click **"1. Simulate Counter QR Swap"**. A toast notification confirms an attacker placed a malicious sticker (`scammer.swap@ybl`) at shop KIR-0001.
- **Visual**: Return to the **Check** screen, select preset **"KIR-0001 Swapped QR"**, and click **Check**.
- **Presenter**:
  > *"Now, imagine a scammer sticks a fraudulent QR sticker over the merchant's standee. The customer scans it. Immediately, the screen flashes red: DANGER! Our physical counter binding algorithm detects that this payee differs from the registered merchant at this exact location."*
- **Visual**: Switch to the **Merchant** screen and select **Lakshmi Kirana Store (KIR-0001)**.
- **Presenter**:
  > *"Crucially, the merchant is not left in the dark. The shopkeeper's phone instantly raises an alert with the fraudulent UPI ID and scan count, empowering the owner to physically peel off the fake sticker within seconds."*

---

### Beat 2: Cross-Channel Scam Story Linking (1:30 – 2:30)
- **Visual**: Switch to the **Demo Panel** screen. Click **"3. Simulate Scam Message with Payee"**.
- **Presenter**:
  > *"Next: Cross-channel extortion. A senior citizen receives an urgent SMS: 'CBI Digital Arrest warrant issued for money laundering. Pay Rs 50,000 immediately to officer.cbi.investigation@okaxis or face arrest.' When this message is checked, the detector flags it as a scam and automatically records the extortionist's UPI ID in our local database."*
- **Visual**: Return to the **Check** screen. Select preset **"Scam-Linked QR"** (contains `officer.cbi.investigation@okaxis`). Click **Check**.
- **Presenter**:
  > *"Two days later, the scammer sends a QR code or payment link to collect the money. The victim scans it. Look at the result: instant DANGER! The app directly cites the scam story: 'This payee was previously flagged in connection with a CBI Digital Arrest threat.' The victim is stopped before authorizing the transfer."*

---

### Beat 3: Multimodal Defense — Screenshot OCR & APK Triage (2:30 – 3:15)
- **Visual**: On the **Check** screen, click **"Check Message or Text"** and show an electricity disconnection threat SMS.
- **Presenter**:
  > *"QRaksha-Kavach handles multiple channels. If someone receives a screenshot or photo, our offline OpenCV engine decodes the QR code first; if missing, Tesseract OCR extracts both English and Telugu text."*
- **Visual**: Show the **Upload APK Metadata** feature.
- **Presenter**:
  > *"To protect users from malicious APK lures like fake traffic challan or PM-Kisan apps, our static APK triage evaluates requested permissions. If an app from outside the Play Store asks for SMS access or Accessibility services — common tricks used to steal OTPs — it is immediately flagged as DANGER without ever downloading or executing dangerous binaries."*

---

### Beat 4: Live Metrics & Architectural Differentiation (3:15 – 4:00)
- **Visual**: Switch to the **Metrics** screen. Scroll through the live benchmark statistics and the 30-scenario breakdown table.
- **Presenter**:
  > *"Finally, let's look at the metrics. QRaksha-Kavach achieves 100% accuracy across all 30 SPEC benchmark scenarios. On 20 held-out scam messages evaluated without tuning, it achieves 95% accuracy and 0% false alarms on legitimate bank notices. Because our detection rules run on pure Python math, median latency is just 1.29 milliseconds."*
- **Visual**: Show the differentiation points at the bottom of the Metrics screen.
- **Presenter**:
  > *"Why QRaksha-Kavach? Unlike generic payment apps, we bind payments to physical locations, alert merchants in real-time, link scam messages to payment destinations, and operate 100% offline without collecting private PINs or exact GPS coordinates. QRaksha-Kavach: Protecting India's digital payments, one counter at a time. Thank you!"*
