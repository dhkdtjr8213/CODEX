# 한국 가계부 SaaS 모노레포

한국 사용자 대상 가계부 MVP를 위한 모노레포입니다.
모바일 앱과 웹이 같은 Supabase 인증/DB를 공유하며 동작합니다.

## 현재 구조

```text
apps/
  mobile/   Expo + React Native
  web/      Next.js + Tailwind
packages/
  config/   공통 설정 및 선택 옵션
  supabase/ 공통 Supabase 인증/CRUD helper
  types/    공통 도메인 타입 및 zod 스키마
  ui/       공통 포맷팅 및 UI helper
docs/
  deployment-checklist.md
  extension-points.md
  web-management.md
  supabase-auth-sync.md
supabase/
  migrations/
```

## MVP 범위

- 인증: Supabase Auth 기반 이메일 로그인
- 핵심 도메인: `account`, `category`, `transaction`, `budget`, `recurring_transaction`
- 거래 타입: `income`, `expense`, `transfer`
- 모바일: 홈/빠른 입력/거래 목록/관리
- 웹: 월별 달력, 대시보드, 거래 검토(필터/내보내기), 관리, 설정

## 환경 변수

루트 `.env.example`를 기준으로 앱별 환경 파일을 채웁니다.

### 웹 (`apps/web/.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DEFAULT_CURRENCY=KRW
```

### 모바일 (`apps/mobile/.env`)

```bash
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_DEFAULT_CURRENCY=KRW
```

## 시작 방법

```bash
pnpm install
pnpm dev:web
pnpm dev:mobile
```

## 주요 운영 명령

```bash
pnpm typecheck
pnpm lint
pnpm smoke
pnpm smoke:with-env
pnpm ops:check-env
pnpm ops:check-recurring-batch
```

## 수동 검증 핵심 시나리오

1. 웹/모바일 동일 계정 로그인 확인
2. 모바일 입력 거래가 웹에 즉시 반영되는지 확인
3. 웹 거래 검토에서 검색/필터/기간/내보내기 동작 확인
4. 월별 달력에서 날짜별 입출금/이체 확인
5. 관리 탭에서 계정/카테고리/예산/반복거래 등록 및 수정 확인

## 진행 현황 문서

- 현재 구현/진행/다음 작업: `docs/current-progress.md`
- 반복거래 배치 스케줄러: `docs/recurring-batch-scheduler.md`
- 상세 기능 매뉴얼: `docs/feature-manual.md`

## 다음 단계 TODO

1. 반복거래 자동 생성 배치 고도화
2. 카테고리 기본값 seed 전략 보강
3. Google 로그인 확장
4. TanStack Query 무효화 정책 정리
5. 차트 라이브러리 실제 연결
6. 웹 필터 URL 공유 안정화
7. CSV 외 XLSX 리포트 포맷 확장
