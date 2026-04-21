# 반복거래 자동 실행 스케줄 가이드

## 목적
- `recurring_transactions`에서 실행 시점이 도래한 항목을 찾아 실제 `transactions`를 자동 생성한다.
- 중복 실행은 DB unique 제약과 실행 로그로 방지한다.

## 운영 흐름
1. 마이그레이션을 적용한다.
2. Edge Function을 배포한다.
3. 운영 시크릿을 설정한다.
4. 스케줄러가 Edge Function을 호출한다.
5. 실행 결과를 로그 테이블에서 확인한다.

## 사전 준비
- `supabase/migrations/0001_mvp_auth_and_ledger.sql` 적용
- `supabase/migrations/0002_recurring_execution_batch.sql` 적용
- `supabase/migrations/0003_recurring_execution_failure_details.sql` 적용
- `supabase/functions/run-recurring-batch/index.ts` 배포
- [docs/deployment-checklist.md](./deployment-checklist.md)에서 redirect URL과 시크릿 설정을 먼저 맞춘다.

## Edge Function 설정
- 경로: `supabase/functions/run-recurring-batch/index.ts`
- 호출 방식: `POST`
- 검증: `x-cron-secret` 헤더를 `CRON_SECRET`과 비교
- 내부 호출: `public.run_due_recurring_transactions(p_limit)` RPC

## 필요한 시크릿
### Supabase Edge Function
- `SUPABASE_URL` = `https://<project-ref>.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY` = service role key
- `CRON_SECRET` = 외부 스케줄러가 보낼 공유 비밀값
- `SUPABASE_ACCESS_TOKEN` = Supabase CLI 로그인 토큰(배포 자동화 시 필요)
- `SUPABASE_PROJECT_REF` = Supabase 프로젝트 ref (예: `abcd1234efgh5678`)

### GitHub Actions cron
- `SUPABASE_PROJECT_URL` = `https://<project-ref>.supabase.co`
- `CRON_SECRET` = Edge Function과 동일한 값

## 배포 예시
```bash
supabase functions deploy run-recurring-batch --no-verify-jwt
supabase secrets set SUPABASE_URL="https://<project-ref>.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<service-role-key>"
supabase secrets set CRON_SECRET="<long-random-string>"
```

프로젝트 스크립트로 자동 배포하려면:

```bash
pnpm ops:deploy-recurring-function
```

## 수동 호출 예시
```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/run-recurring-batch?limit=200" \
  -H "x-cron-secret: <CRON_SECRET>"
```

## 안전 점검(dry-run) 예시
- 실제 거래를 생성하지 않고, 현재 시점에 실행 대상이 몇 건인지 확인할 수 있다.
- Edge Function 쿼리에 `dry_run=true`를 붙이면 미리보기 모드로 동작한다.

```bash
curl -X POST "https://<project-ref>.supabase.co/functions/v1/run-recurring-batch?dry_run=true&limit=10" \
  -H "x-cron-secret: <CRON_SECRET>"
```

로컬에서 env를 이미 세팅했다면 아래 명령으로도 확인할 수 있다.

```bash
pnpm ops:check-recurring-batch
```

실제 실행 호출까지 확인하려면:

```bash
pnpm ops:check-recurring-batch --execute
```

추가로 `SUPABASE_SERVICE_ROLE_KEY`가 설정되어 있으면 최근 실행 로그의 성공/실패 및 실패 사유 상위 요약을 함께 출력한다.

## 스케줄 연결
- GitHub Actions: `.github/workflows/recurring-batch-cron.yml`
- 다른 선택지: Cloud Scheduler, 서버 cron, 외부 오케스트레이터
- 기본 권장 주기: 1시간 1회 또는 1일 1회

## 검증 단계
1. `next_run_at <= now()`인 반복거래를 하나 준비한다.
2. 함수를 수동 호출한다.
3. `transactions`에 새 거래가 생성되는지 확인한다.
4. `recurring_transaction_executions`에 로그가 남는지 확인한다.
5. `next_run_at`이 다음 실행 시점으로 이동했는지 확인한다.

## 장애 확인 포인트
- 401/403: `CRON_SECRET` 불일치 또는 누락
- 500: RPC 실패, 마이그레이션 미적용, 권한 오류
- 중복 생성 방지 실패: 로그 테이블 unique 제약 확인

## 관련 문서
- [docs/deployment-checklist.md](./deployment-checklist.md)
