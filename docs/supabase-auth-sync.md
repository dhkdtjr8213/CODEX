# Supabase 인증/동기화 가이드

## 목표
- 앱과 웹에서 같은 계정으로 로그인한다.
- 같은 Supabase Auth / Postgres 데이터를 공유한다.
- 사용자별 데이터는 RLS로 격리한다.

## 환경변수

### Web
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Mobile
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `EXPO_PUBLIC_SUPABASE_ANON_KEY`

### Server/Batch
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

## 인증 흐름

### 웹
1. 브라우저에서 이메일 또는 Google 로그인
2. 세션 복원 후 사용자 스냅샷 확인
3. 대시보드/거래/설정 데이터 조회

### 모바일
1. 앱에서 이메일 또는 Google 로그인
2. 세션을 AsyncStorage 기반으로 유지
3. 홈/입력/목록/관리 화면에서 동일 데이터 사용

## RLS 원칙
- 모든 핵심 테이블은 `user_id`를 기준으로 접근 제한
- `auth.uid() = user_id` 기준의 select/insert/update/delete 정책 사용

## 검증 순서
1. 마이그레이션 적용
2. 웹/모바일 env 설정
3. `pnpm ops:check-env`
4. `pnpm smoke`
5. (운영 환경) `pnpm smoke:with-env`
6. 웹/모바일 동일 계정으로 로그인 후 데이터 동기화 확인

## 참고 문서
- [runtime-env-setup.md](./runtime-env-setup.md)
- [deployment-checklist.md](./deployment-checklist.md)