# Repository Working Agreement

## 목적
이 저장소는 멀티 에이전트 방식으로 작업한다.
각 에이전트는 자신의 역할과 수정 범위를 지키고, 결과는 지정된 형식으로 제출한다.

## 공통 원칙
- 기존 코드 스타일과 구조를 우선 존중한다.
- 불필요한 대규모 리팩토링은 금지한다.
- 현재 작업 범위와 무관한 파일 수정은 금지한다.
- 완료 처리 전 반드시 테스트 가능한 항목을 명시한다.
- 인증, 인가, 업로드, 결제, 시크릿, 환경변수 관련 변경은 반드시 보안 검토를 거친다.
- 프론트/백엔드 계약(API contract)을 깨는 변경은 단독으로 진행하지 않는다.
- 결과물은 항상 재현 가능해야 하며, 변경 파일 목록을 제출해야 한다.

## 현재 스택 기준
- Monorepo: pnpm workspace
- Web: Next.js App Router + TypeScript + Tailwind (`apps/web`)
- Mobile: Expo + React Native + TypeScript (`apps/mobile`)
- Backend: Supabase (Auth, Postgres, RLS, Storage)
- Shared: `packages/types`, `packages/config`, `packages/supabase`, `packages/ui`

## 역할 분리
- chief: 전체 방향, 승인, 병합 판단
- deputy: 작업 분해, 의존성 관리, 할당 조정
- planner: 요구사항 명세, 유저 플로우, acceptance criteria 작성
- types: 공용 타입/폼 스키마/계약 잠금 단계 전담
- backend: Supabase 쿼리/서버 로직/마이그레이션
- frontend-web: `apps/web` 전담
- frontend-mobile: `apps/mobile` 전담
- designer: 공통 UI 구조/토큰/UX 카피
- tester: test plan, unit/integration/e2e checks
- reviewer: code quality, maintainability, duplication, conventions
- security: auth/session, input validation, secrets, dependency risk

## 수정 범위 원칙
- types: `packages/types/*`, `packages/config/*` 중심으로 계약을 먼저 확정한다.
- backend: `packages/supabase/src/*`, `supabase/migrations/*`, 서버 로직 관련 문서만 수정한다.
- frontend-web: `apps/web/*`만 수정한다.
- frontend-mobile: `apps/mobile/*`만 수정한다.
- designer: `packages/ui/src/*`, `packages/ui/src/tokens/*`, 관련 UX 문서를 수정한다.
- tester/reviewer/security는 기본적으로 직접 구현보다 보고와 수정 제안이 우선이다.
- chief/deputy/planner는 원칙적으로 대규모 코드 구현을 직접 하지 않는다.

## 모노레포 의존성 순서 (필수)
아래 순서가 깨지면 연쇄 타입 오류가 발생할 수 있으므로 반드시 지킨다.
1. `packages/types`
2. `packages/config`
3. `packages/supabase`
4. `packages/ui`
5. `apps/web`, `apps/mobile`

## Supabase 특화 규칙
- 스키마/정책 변경 시 `supabase/migrations/*.sql`에 반영한다.
- RLS는 대상 테이블마다 활성화 여부를 확인한다.
- 정책은 최소 `select/insert/update/delete` 4종을 점검한다.
- `service_role` 키/기타 시크릿은 클라이언트 코드에 노출하지 않는다.
- `NEXT_PUBLIC_*`, `EXPO_PUBLIC_*`에 시크릿을 넣지 않는다.
- Storage bucket 공개 범위(public/private)를 변경 시 명시한다.
- 스키마 변경 시 `supabase gen types` 실행 결과를 공유 타입에 동기화한다.

## 병렬 작업 원칙
- `backend`와 `designer`는 병렬 가능하되 공용 타입 계약(`types_lockdown`) 이후에만 진행한다.
- `frontend-web`과 `frontend-mobile`은 서로 독립적으로 병렬 진행한다.
- 같은 파일에 대한 동시 수정은 금지한다.
- 공용 타입/API contract/env 규칙 변경은 deputy가 먼저 조정한다.

## 머지 게이트
다음 조건이 충족되기 전에는 merge 금지:
- tester 결과 통과
- reviewer 승인
- security 승인 (보안 민감 변경 시 필수)

## 출력 형식 계약
각 에이전트는 가능한 한 아래 형식으로 결과를 제출한다.
1. summary
2. files_to_change
3. proposed_changes
4. tests_to_run
5. risks
6. handoff_needed

## 금지 사항
- 비밀키, 토큰, 인증정보를 코드/문서에 평문으로 남기지 않는다.
- 사용자 요청 없이 의존성을 대량 교체하지 않는다.
- 사유 없는 파일 전체 재포맷을 하지 않는다.
- 실패를 숨기지 않는다. 막힌 부분은 명확히 보고한다.
