
# AGENTS.md — QRaksha-Kavach Project Instructions

## Project Overview
Project: QRaksha-Kavach

Before starting every task, read `SPEC.md` completely and follow its requirements. If a task conflicts with `SPEC.md`, explain the conflict and wait for clarification.

## 1. Planning Before Implementation
- Plan first. 
- Write a short implementation plan to docs/CHANGELOG.md (or your working notes) and proceed immediately without waiting for approval, pausing only if you need a new dependency (Rule 4) or hit a failure you cannot fix in 3 tries.

## 2. One Step at a Time
- Complete one implementation step at a time.
- Do not move to the next step without completing the current one.
- Modify only the files explicitly identified in the approved task or implementation plan.
- Do not make unrelated changes, refactor unrelated code, or modify additional files without approval.
- If additional files become necessary, explain why and request approval before modifying them.

## 3. Python Coding Standards
- Use Python 3.11.
- Include type hints for function parameters, return values, and important variables where appropriate.
- Use Pydantic models for structured data validation and data representation.
- Write short, meaningful docstrings in simple English.
- Keep functions small, readable, and focused on a single responsibility.
- Follow consistent naming conventions and maintain the existing project structure.
- Prefer beginner-friendly code over unnecessary abstractions.

## 4. Dependency Management
- Do not introduce any new package or dependency without asking for explicit approval.
- Reuse existing dependencies wherever possible.
- Maintain dependency versions in `requirements.txt`.
- Pin dependency versions explicitly.
- If a new dependency is necessary, explain its purpose and request approval before installing or adding it.

## 5. Detector Architecture and Testing
- Every detector must return the `Signal` object defined in Section 4.2 of `SPEC.md`.
- Follow the exact `Signal` structure and field definitions specified in the project specification.
- Do not introduce alternative detector output formats.
- Every detector must have corresponding unit tests under the appropriate `tests/test_*` file.
- Tests must cover normal cases, suspicious cases, edge cases, and invalid inputs where applicable.
- Keep detectors independent and modular.

## 6. Configuration-Driven Rules
- All thresholds, keywords, detection rules, and configurable values must be stored in `app/config/*.yaml`.
- Never hard-code thresholds, keywords, or detection rules directly into Python source files.
- Load configuration values from the appropriate YAML files at runtime.
- Ensure the application handles missing or invalid configuration safely.

## 7. Centralized LLM Integration
- All LLM calls must go exclusively through `app/llm.py`.
- Do not call LLM APIs directly from detectors, routes, controllers, or other modules.
- Implement response caching in `app/llm.py` to avoid unnecessary repeated API calls.
- If the LLM is unavailable or the application is offline, automatically fall back to rules-only detection.
- The application must remain functional without internet connectivity or LLM access.

## 8. Centralized Safety Explanations
- All safety messages, warnings, recommendations, and user-facing explanations must come exclusively from `app/config/explanations.yaml`.
- Never generate safety advice dynamically using the LLM.
- The LLM may assist with classification, risk assessment, and evidence extraction, but must not write or modify safety instructions shown to users.
- Use predefined explanations corresponding to the detected risk level or verdict.

## 9. Privacy and Synthetic Data
- Never request, collect, log, or store UPI PINs, OTPs, passwords, or other authentication credentials.
- Never request, collect, log, or store users' exact GPS coordinates or precise location data.
- Use synthetic, mock, or anonymized data exclusively for development, testing, and demonstrations.
- Do not use real customer, merchant, banking, or personally identifiable information.
- Ensure logs and error messages do not expose sensitive information.

## 10. Security and APK Triage Restrictions
- Do not write malware, malicious scripts, exploits, or code designed to attack, compromise, or disrupt other systems.
- APK triage must operate exclusively on static metadata provided as JSON.
- Allowed APK metadata includes app name, package name, requested permissions, SDK information, and other extracted metadata fields.
- Never execute, install, or dynamically analyze APK files.
- Treat APK metadata as untrusted input and validate it before processing.

## 11. Completion and Verification Requirements
Before considering any task complete:

1. Run the complete test suite using `pytest`.
2. Display the actual test execution results, including passed, failed, and skipped tests.
3. Never claim that tests passed unless they were actually executed successfully.
4. If tests fail, investigate the failures, fix issues introduced by the changes, and rerun the relevant tests.
5. List all files created, modified, or deleted.
6. Explain the implemented changes in simple, beginner-friendly language.
7. Mention known limitations, incomplete functionality, or remaining issues.
8. Suggest a concise and descriptive Git commit message.

## 12. General Instructions
- Always read `SPEC.md` before starting a new task.
- Treat `SPEC.md` as the primary source of truth for project architecture and functional requirements.
- Do not assume missing requirements or invent functionality.
- Ask for clarification when requirements are ambiguous.
- Preserve existing working functionality.
- Avoid unnecessary complexity and premature optimization.
- Prioritize correctness, security, privacy, maintainability, and readability.
- Do not silently skip requirements or tests.
- Clearly communicate blockers before proceeding.

## Expected Workflow for Every Task

1. Read `SPEC.md`.
2. Understand the requested task and relevant existing code.
3. Prepare an implementation plan.
4. Identify the exact files that need modification.
5. Present the plan and wait for explicit approval.
6. Implement only the approved step.
7. Run relevant tests.
8. Run the complete `pytest` suite when implementation is complete.
9. Report changed files, test results, implementation summary, limitations, and a suggested Git commit message.
