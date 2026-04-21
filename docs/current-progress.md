# 현재 진행 상황

기준일: 2026-04-20

## 최신 업데이트 (2026-04-20)
- Web 디자인 1차 개선 반영
  - 대시보드 상단 `Core KPI` 블록 추가(핵심 숫자 4종 + 빠른 액션)
  - 빠른 입력 `최근 템플릿` 카드 밀도 개선(3열, 사용횟수 배지)
  - 거래 입력 시 기본 카테고리 자동 채움 로직 추가
- Web 디자인 2차 보정 반영
  - KPI 카드에 위험 톤(잔액 음수/예산 위험) 강조 색상 반영
  - KPI 4번째 지표를 `예산 위험/집중도`로 교체
  - KPI 색상 기준을 `packages/ui` 공통 토큰(`kpiToneTokens`)으로 연결
- Mobile 디자인/기능 1차 개선 반영
  - 홈에 `스타터 팩` 카드 추가(누락 계정/카테고리 수 안내 + 원탭 적용)
  - 홈에 `월간 인사이트 Top 3` 카드 추가(지출 상위 카테고리)
  - 스타터 팩 적용 중 중복 클릭 방지(`ActionButton disabled`) 반영
- Mobile 기능 2차 반영
  - 입력 화면에 `최근 사용 템플릿` 원탭 불러오기 추가
  - 템플릿 카드에 거래 유형/계정/카테고리 정보 보강
  - 길게 눌러 템플릿 고정(pin) + 고정 템플릿 우선 정렬 반영
- 하네스 안정화 보강
  - 역할별 실행 제한시간 도입: `HARNESS_ROLE_TIMEOUT_SEC`(기본 90초)
  - 전체 실행 제한시간 도입: `HARNESS_FULL_TIMEOUT_MS`(기본 900000ms)
  - timeout 발생 시 원인 메시지 명시
  - `연속 실패 시 조기 종료` 도입: `HARNESS_MAX_CONSECUTIVE_FAILURES`(기본 3)
  - Windows에서 timeout 시 프로세스 트리 강제 종료(`taskkill /T`)
- `pnpm ops:pr-rehearsal`: PASS
  - `typecheck`, `lint`, `smoke` 통과
  - 리포트 갱신: `docs/manual-kit/pr-rehearsal-last-report.md`
- `pnpm ops:preflight`: PASS (실운영 연결 재검증 완료)
  - 리포트 갱신: `docs/manual-kit/preflight-last-report.md`
  - 체크리스트 자동 갱신: `docs/deployment-checklist.md`
- 장시간 하네스 검증(`HARNESS_QUICK_MODE=0`): 진행 시간 이슈 지속
  - 10분/20분 실행 모두 타임아웃으로 완주 실패
  - `work/tasks/LEDGER-20260420-094555`, `work/tasks/LEDGER-20260420-100433`에서 중간 산출물 확인
  - 튜닝 재검증(`ROLE_TIMEOUT=45`, `FULL_TIMEOUT=720000`)도 전체 타임아웃
  - 단, 역할별 timeout 기록 확인(`chief/deputy/planner/types` fail-fast)
    - `work/tasks/LEDGER-20260420-130704/state.json`
  - 개선 재검증(`ROLE_TIMEOUT=30`, `MAX_CONSECUTIVE_FAILURES=1`) 결과
    - `state=failed`로 조기 종료 확인
    - reason: `Stopped early due to consecutive role failures` (last_role: chief)
  - 프로세스 트리 강제 종료 반영 후 재검증에서도 동일하게 조기 종료 확인
    - `LEDGER-20260420-142436`: state failed / reason 정상 출력 / 잔여 프로세스 없음
- PR 게이트 상태
  - PR #1은 여전히 `draft/open`, 리뷰 승인 없음
  - Ready 전환 API 재시도 실패: GitHub 앱 토큰 만료(`token_expired`)
- 레퍼런스 기반 기획 산출물 추가
  - `docs/reference-based-feature-screen-blueprint-2026-04-20.md`

## 완료
- 웹 IA 및 달력/거래검토 UX 개선
  - 좌측 워크스페이스/관리 서브메뉴 구조 정리
  - URL 상태 동기화(`view`, `mtab`, 필터 파라미터)
  - 월 요약 카드/범례/선택일 빠른 입력 동선
  - 저장 프리셋, 선택 거래 일괄 카테고리 변경
- 반복배치 운영 개선
  - 실행 로그 요약/필터/재실행 가이드 개선
  - `ops:preflight` 자동 리포트 갱신
  - 실패 원인 추적 마이그레이션 추가
    - `0003_recurring_execution_failure_details.sql`
    - `status`, `error_message` 컬럼 및 예외 처리 반영
- 릴리즈 준비
  - CI 워크플로 추가(`Typecheck`, `Lint`, `Smoke`)
  - 브랜치 보호 규칙 가이드 문서 추가
- 멀티 에이전트 스택 특화 골격 추가
  - `AGENTS.md`를 역할/스코프/게이트 규약으로 교체
  - `.codex/config.toml` 모델을 `gpt-5.3-codex`로 고정
  - `.agents/skills/*` 11개 역할 스킬 작성
    - `types`, `frontend-web`, `frontend-mobile` 분리
  - `harness/orchestrator.py`에 `types_lockdown` 단계 반영
  - 병렬 단계 분리
    - `backend + designer`
    - `frontend-web + frontend-mobile`
  - Supabase 특화 보안 체크리스트를 `security` 스킬에 반영

## 진행 중
- `harness/codex_runner.py` 실호출(OpenAI API 키 설정) 검증

## 오늘 확인한 검증 결과
- `pnpm typecheck`: 통과
- `pnpm lint`: 통과
- `npm run smoke`: 통과
- `pnpm ops:check-env`: 통과 (7/7)
- `pnpm ops:check-recurring-batch`: 통과 (dry-run)
- `pnpm ops:check-recurring-batch --execute`: 통과
- `pnpm ops:ready:full`: 통과
- `pnpm ops:preflight`: 통과
- 멀티 에이전트 정적 검증: 완료
  - 역할 파일/하네스 파일 생성 확인
  - `types_lockdown` 및 frontend 분리 단계 확인
- 멀티 에이전트 실행 검증: 완료
  - Python 런타임 복구 후 `harness/orchestrator.py --mock` 통과
  - `AGENT_RUNNER_CMD` + `harness/codex_runner.py` 스텁 연동 통과
- 브랜치 보호 자동화 스크립트 검증: 완료
  - `pnpm ops:github:protect-main:dry` 통과
  - `pnpm ops:github:protect-main` 적용 성공
  - `main` 브랜치 메타데이터 확인: `protected=true`
- `codex_runner` 업그레이드 검증: 완료
  - OpenAI Responses API 호출 경로 추가
  - `OPENAI_API_KEY` 미설정 fallback 동작 확인
- `pnpm ops:check-harness-runner`: 통과
  - task id: `LEDGER-20260415-124555`
  - 현재는 fallback mode 검증(no key)
- `OPENAI_API_KEY` 실호출 점검: 실패
  - task id: `LEDGER-20260415-125347`
  - OpenAI API `429` (`insufficient_quota`)
- 멀티 provider 전환 지원: 완료
  - `harness/codex_runner.py`에서 `openai_responses`, `openai_compatible_chat`, `gemini_generate_content` 지원
  - `HARNESS_ALLOW_FALLBACK=1` 모드 점검 통과 (`LEDGER-20260415-125744`)
- Gemma4 E4B 실연결: 완료
  - Ollama 설치 + `gemma4:e4b` 모델 pull 완료
  - `pnpm ops:check-harness-runner` quick mode 통과 (`fallback_output: no`)
- PR 워크플로 리허설: 완료
  - `pnpm ops:pr-rehearsal` 통과
  - 리포트: `docs/manual-kit/pr-rehearsal-last-report.md`

## 다음 작업 순서
1. Draft PR 리뷰 반영 및 merge 준비
   - PR: `https://github.com/dhkdtjr8213/CODEX/pull/1`
2. 필요 시 `HARNESS_QUICK_MODE=0`로 전체 오케스트레이터 장시간 검증

## 관련 문서
- [feature-manual.md](./feature-manual.md)
- [deployment-checklist.md](./deployment-checklist.md)
- [recurring-batch-scheduler.md](./recurring-batch-scheduler.md)
- [github-branch-protection.md](./github-branch-protection.md)
- [manual-kit/preflight-last-report.md](./manual-kit/preflight-last-report.md)
