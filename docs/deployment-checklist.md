# 배포 체크리스트

## 1. 로컬 검증
- `pnpm install`
- `pnpm ops:check-env`
- `pnpm smoke`
- `pnpm smoke:with-env` (운영 변수까지 점검할 때)
- `pnpm --filter web build`
- `pnpm --filter mobile start`

## 2. 환경변수 준비
- 루트 [.env.example](../.env.example) 기준으로 값 출처를 정리한다.
- Web: [apps/web/.env.example](../apps/web/.env.example) 기준으로 `apps/web/.env.local`을 채운다.
- Mobile: [apps/mobile/.env.example](../apps/mobile/.env.example) 기준으로 `apps/mobile/.env`를 채운다.
- `SUPABASE_SERVICE_ROLE_KEY`는 클라이언트 env에 넣지 않는다.
- 상세 절차: [runtime-env-setup.md](./runtime-env-setup.md)

## 3. Supabase Auth 설정
- Supabase Auth에서 Google Provider를 활성화한다.
- Redirect URL을 모두 등록한다.
  - Web: `https://<web-domain>/`
  - Mobile: `household-ledger://auth/callback`
  - 로컬 개발 시: `http://localhost:<port>/`

## 4. DB / 마이그레이션
- `supabase/migrations/0001_mvp_auth_and_ledger.sql` 적용
- `supabase/migrations/0002_recurring_execution_batch.sql` 적용
- RLS 정책 활성 상태 확인
- 반복거래 실행 함수/로그 테이블 생성 확인

## 5. 반복배치 운영 연결
- [recurring-batch-scheduler.md](./recurring-batch-scheduler.md) 순서로 배치 연결
- 운영 시크릿 설정 후 `pnpm ops:check-recurring-batch`로 dry-run 검증
- 실제 실행 후 `transactions` 생성 및 `recurring_transaction_executions` 로그 확인

## 6. 핵심 사용자 흐름 검증
1. 같은 계정으로 웹/모바일 로그인
2. 모바일에서 수입/지출/이체 입력
3. 웹에서 즉시 반영 확인
4. 웹에서 수정/삭제 후 모바일 반영 확인
5. 예산/카테고리/반복거래 편집 흐름 확인

## 7. 배포 직전
- `pnpm ops:preflight`
- 에러/로딩/빈 상태 화면 점검
- 첫 화면(이번 달 수지, 최근 내역, 빠른 입력) 노출 확인