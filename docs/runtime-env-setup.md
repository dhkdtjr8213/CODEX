# 운영 환경변수 연결 가이드

이 문서는 `pnpm smoke:with-env` 및 `pnpm ops:preflight`를 통과시키기 위한 최소 환경변수 설정 순서를 정리합니다.

## 1. 필수 변수 목록

### Web (apps/web/.env.local)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_DEFAULT_CURRENCY` (기본값 `KRW`)

### Mobile (apps/mobile/.env)
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_DEFAULT_CURRENCY` (기본값 `KRW`)

### Server/Batch (루트 실행 환경)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

## 2. 설정 순서
1. 루트 `.env.example`을 기준으로 값 출처를 먼저 정한다.
2. `apps/web/.env.example`을 참고해 `apps/web/.env.local`을 채운다.
3. `apps/mobile/.env.example`을 참고해 `apps/mobile/.env`를 채운다.
4. 배치/운영 스크립트를 실행하는 셸(또는 CI Secret)에 서버 변수를 주입한다.
5. `SUPABASE_SERVICE_ROLE_KEY`는 절대 웹/모바일 클라이언트 env 파일에 넣지 않는다.

## 3. 검증 명령
```bash
pnpm ops:check-env
pnpm smoke
pnpm smoke:with-env
pnpm ops:check-recurring-batch
pnpm ops:preflight
pnpm ops:ready
pnpm ops:ready:full
```

- `pnpm ops:ready`: `smoke` + `ops:progress` + `ops:preflight`(로컬 안전 모드) 순서로 실행
- `pnpm ops:ready:full`: env/배치 검증까지 포함한 전체 점검 모드

## 4. 실패 시 빠른 확인
- `ops:check-env`에서 누락된 그룹(`web`, `mobile`, `supabase`)이 무엇인지 먼저 확인한다.
- Web/Mobile URL은 같은 Supabase 프로젝트를 가리키는지 확인한다.
- Google 로그인 사용 시 Supabase Auth에 아래 URL이 등록되어 있는지 확인한다.
  - Web: `https://<web-domain>/`
  - Mobile: `household-ledger://auth/callback`

## 5. 오늘 기준 현재 차단 포인트 (2026-04-13)
아래 값이 비어 있으면 `smoke:with-env`와 `ops:preflight`는 실패합니다.
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`
