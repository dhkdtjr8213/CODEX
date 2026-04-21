# 기능 매뉴얼
최종 업데이트: 2026-04-15

이 문서는 현재 저장소에서 동작하는 MVP 기능과 운영/검증 방법을 한 곳에 정리한 안내서입니다.

## 1. 현재 구현 범위

### 공통 도메인
- 사용자/프로필 (`user`, `profile`)
- 계정 (`account`)
- 카테고리 (`category`)
- 거래 (`transaction`)
- 예산 (`budget`)
- 반복거래 (`recurring_transaction`)

### 거래 타입
- 수입 (`income`)
- 지출 (`expense`)
- 이체 (`transfer`)

### 공통 원칙
- 모바일/웹은 같은 Supabase 인증과 DB를 공유합니다.
- 삭제는 hard delete보다 soft delete 흐름을 우선 적용합니다.
- 금액/날짜/통화 포맷은 한국 사용자 기준을 기본으로 둡니다.

## 2. 웹 기능

### 워크스페이스 IA
- 좌측 메인 메뉴: 월별 달력, 대시보드, 거래 검토, 관리, 설정
- URL 상태 동기화: 새로고침 후에도 현재 탭/필터/관리 섹션 유지

### 월별 달력
- 월 단위 그리드로 날짜별 수입/지출/이체 확인
- 오늘/주말 강조, 키보드 이동(화살표)
- 카테고리 색상 점 표시 및 지출 카테고리 강조 범례
- 우측 상세 패널에서 해당 날짜 거래 수정/삭제
- 선택 날짜 기준 빠른 입력 동선 제공

### 거래 검토
- 검색/필터: 기간, 유형, 계정, 카테고리, 정렬
- 카드/테이블 보기 전환
- 컬럼 표시 토글, 페이지 크기 조절, 페이지 이동
- 결과 내보내기: CSV/XLSX
- 선택 행 일괄 작업
  - 선택 삭제
  - 선택 카테고리 일괄 변경
- 저장 프리셋: 월급일, 고정비, 식비

### 관리
- 좌측 서브메뉴 기반 섹션 분리
  - 빠른 입력
  - 계정
  - 카테고리
  - 예산
  - 반복거래
  - 실행로그

### 반복배치 실행로그
- 최근 7일 성공/실패 요약
- 누적 성공/실패 요약
- 실패 로그 필터(검색/기간/사유상태)
- 실패 사유 상세 확인
- 재실행 명령 가이드 및 복사 버튼

### 설정
- 표시 이름
- 기본 통화
- 주 시작 요일
- 월 시작일

## 3. 모바일 기능
- 홈: 이번 달 요약/최근 거래/핵심 관리 진입
- 입력: 수입/지출/이체 빠른 기록
- 목록: 최근 거래 확인
- 관리: 계정/카테고리/예산/반복거래 기본 관리

## 4. 반복배치 운영

### 마이그레이션
- `supabase/migrations/0001_mvp_auth_and_ledger.sql`
- `supabase/migrations/0002_recurring_execution_batch.sql`
- `supabase/migrations/0003_recurring_execution_failure_details.sql`

### 점검 명령
- dry-run:
  - `pnpm ops:check-recurring-batch`
- execute:
  - `pnpm ops:check-recurring-batch --execute`

### 관련 문서
- [recurring-batch-scheduler.md](./recurring-batch-scheduler.md)
- [deployment-checklist.md](./deployment-checklist.md)

## 5. 운영 명령
- `pnpm ops:check-env`
- `pnpm ops:check-harness-runner`
- `pnpm smoke`
- `pnpm smoke:with-env`
- `pnpm ops:preflight`
- `pnpm ops:preflight:local`
- `pnpm ops:ready`
- `pnpm ops:ready:full`

## 6. 수동 검증 체크리스트
1. 웹/모바일 동일 계정 로그인 확인
2. 모바일 입력 거래의 웹 반영 확인
3. 웹 수정/삭제 거래의 모바일 반영 확인
4. 거래 검토 필터/정렬/내보내기 확인
5. 달력 상세 패널의 수정/삭제/빠른입력 동선 확인
6. 반복배치 로그의 실패 원인 표시 확인

## 7. 릴리즈 준비
- CI 필수 검사: `Typecheck`, `Lint`, `Smoke`
- 브랜치 보호 규칙: [github-branch-protection.md](./github-branch-protection.md)

## 8. 제한사항
- MVP 단계에서는 오픈뱅킹 자동 연동 미포함
- 운영 env 미설정 시 `smoke:with-env`와 preflight에서 경고/실패 가능

## 9. 다음 TODO
- 반복배치 실환경 execute 검증
- main 브랜치 보호 규칙 실제 적용
- 관리 화면 세부 UX 폴리싱(정보 밀도/반응형)

## 10. 멀티 에이전트 작업 체계
- 규약 문서: `AGENTS.md`
- 역할 스킬: `.agents/skills/*/SKILL.md`
  - 핵심 분리: `types`, `frontend-web`, `frontend-mobile`
- 하네스: `harness/orchestrator.py`
  - 실행 순서:
    1. chief kickoff
    2. deputy breakdown
    3. planner spec
    4. types lockdown
    5. backend + designer (병렬)
    6. frontend-web + frontend-mobile (병렬)
    7. tester/reviewer/security
    8. chief final
- 모델 설정: `.codex/config.toml` (`gpt-5.3-codex`)
- 주의:
  - `OPENAI_API_KEY`가 없으면 `codex_runner`는 fallback 출력으로 동작합니다.
  - 실호출 검증 전 `pnpm ops:check-harness-runner`로 러너 연결 상태를 먼저 점검합니다.
  - 실행 산출물은 `work/tasks/*`에 생성됩니다.

### 러너 Provider 전환
- 기본값: `AGENT_PROVIDER=openai_responses`
- Gemma 로컬/호환 서버 사용 시:
  - `AGENT_PROVIDER=openai_compatible_chat`
  - `AGENT_API_BASE=http://127.0.0.1:11434` (예: Ollama OpenAI 호환 엔드포인트)
  - `AGENT_MODEL=<gemma 모델명>`
  - 키가 필요 없는 서버면 `AGENT_API_KEY` 생략 가능
- Gemini API 사용 시:
  - `AGENT_PROVIDER=gemini_generate_content`
  - `AGENT_MODEL=<gemini/gemma 모델명>`
  - `GEMINI_API_KEY` 또는 `GOOGLE_API_KEY` 설정 필요
- 점검:
  - `pnpm ops:check-harness-runner`
  - 쿼터/네트워크 이슈로 fallback을 허용하고 싶으면 `HARNESS_ALLOW_FALLBACK=1`
