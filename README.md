# 한국 가계부 SaaS 모노레포

한국 사용자 대상 수동 입력형 가계부 MVP를 위한 모노레포입니다. 모바일 앱을 먼저 출시하고, 같은 인증과 같은 데이터베이스를 공유하는 웹 관리 화면을 함께 운영하는 구조를 목표로 합니다.

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
- 모바일: 홈, 거래 입력, 거래 목록, 관리 화면, 예산/반복지출 요약
- 웹: 대시보드, 최근 거래, 빠른 입력, 계정/카테고리/예산/반복지출 관리, 월별 통계
- 웹 관리 강화: 거래 검색, 필터, 기간 조회, CSV export, 사용자 기본 설정

## 환경변수

루트 `.env.example`을 기준으로 각 앱 환경파일을 채웁니다.

### 웹

`apps/web/.env.local`

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_DEFAULT_CURRENCY=KRW
```

### 모바일

`apps/mobile/.env`

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

## Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. SQL Editor에서 `supabase/migrations/0001_mvp_auth_and_ledger.sql`을 실행합니다.
3. 웹과 모바일 env 파일에 URL과 key를 채웁니다.
4. 회원가입 후 `accounts`, `categories`, `transactions`에 데이터를 추가해 동기화 흐름을 확인합니다.

## 현재 포함된 기능

- 계정 생성/수정
- 카테고리 생성/수정
- 거래 생성/수정/삭제(soft delete)
- 이번 달 수입/지출/잔액 요약
- 최근 거래내역 목록
- 월별 예산 생성/수정
- 반복지출 등록/수정
- 카테고리별 지출 비중 통계
- 예산 진행률 요약
- 웹 거래 검색/필터/기간 조회
- 필터 결과 CSV export
- 사용자 기본 설정(통화, 주 시작 요일, 월 시작일)
- 빈 상태, 로딩, 에러 메시지

## 검증 명령

```bash
pnpm smoke
pnpm typecheck
pnpm lint
```

`pnpm smoke` 는 우선 전체 타입 체크와 린트를 한 번에 확인하는 명령입니다. `smoke:with-env` 옵션을 추가하면 실행 환경 변수 확인까지 포함합니다.

```bash
pnpm smoke:with-env
```

이 명령은 배포 전, CI 전, 그리고 로컬 확인을 더 빠르게 매일 때 쓰기 좋습니다. 아직 이 저장소에 의존성을 설치하지 않은 상태이므로, 실제 검증은 `pnpm install` 후 진행해야 합니다.

## 품질 정리 메모

- 비밀값 하드코딩은 확인되지 않았습니다.
- Supabase public key 외 service role key는 클라이언트 env에 넣지 말아야 합니다.
- 현재 모바일 lint 스크립트는 `noop`이므로, 실운영 전 ESLint 규칙 추가를 검토해야 합니다.
- 배포 전 체크리스트는 `docs/deployment-checklist.md`를 참고합니다.
- 후속 확장 메모는 `docs/extension-points.md`를 참고합니다.

## 수동 검증 흐름

1. 웹과 모바일에서 같은 계정으로 로그인합니다.
2. 모바일 홈에서 이번 달 요약과 최근 거래가 보이는지 확인합니다.
3. 모바일 관리 화면에서 계정과 카테고리를 생성합니다.
4. 모바일 입력 화면에서 수입/지출/이체 거래를 각각 하나씩 등록합니다.
5. 모바일 관리 화면에서 예산과 반복지출을 등록합니다.
6. 웹 대시보드에서 카테고리별 지출 비중, 예산 진행률, 반복지출 목록이 보이는지 확인합니다.
7. 웹 거래 검토 영역에서 검색, 유형, 계정, 카테고리, 기간 필터가 정상 작동하는지 확인합니다.
8. 필터 결과를 CSV로 내보낸 뒤 한글 텍스트와 금액 열이 정상 표시되는지 확인합니다.
9. 웹 설정 영역에서 표시 이름, 기본 통화, 주 시작 요일, 월 시작일을 저장한 뒤 재로드 시 유지되는지 확인합니다.
10. 웹 또는 모바일에서 예산/반복지출/거래를 수정한 뒤 반대 플랫폼에서도 반영되는지 확인합니다.

## 운영 전 확인

로컬에서 운영 전 필수 환경변수 체크를 할 때는 `pnpm ops:check-env`를 사용합니다. 웹/모바일/Supabase 운영 변수가 누락되었는지 배포 전에 미리 확인하기 위함입니다.

## 다음 단계 TODO

1. 반복지출 자동 생성 배치 추가
2. 카테고리 기본값 seed 전략 추가
3. Google 로그인 확장
4. TanStack Query 기반 쿼리 무효화 정리
5. 차트 라이브러리 실제 연결
6. 웹 필터 URL 동기화 및 공유 링크 지원
7. CSV 외 xlsx export 형식 확장

## 진행?�황 보기

- ?�재 구현/진행/?�음 ?�업: `docs/current-progress.md`
- 반복거래 배치 ?��?줄러 ?�결: `docs/recurring-batch-scheduler.md`



## �ݺ���ġ ����

� ��ũ�� ���� �� �ݺ���ġ ���� ������ �Ʒ� ������� dry-run�� ���� Ȯ���մϴ�.

```bash
pnpm ops:check-recurring-batch
```
