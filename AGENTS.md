# AGENTS.md

## Project Overview
이 프로젝트는 한국 사용자 대상 가계부 SaaS의 MVP를 만드는 저장소다.
앱을 먼저 출시하고, 같은 인증/DB를 공유하는 웹을 함께 운영한다.

## Product Goal
- 모바일 앱에서 빠르게 수입/지출/이체를 기록할 수 있어야 한다.
- 웹에서는 월별 통계, 카테고리 관리, 예산 관리, 설정, 데이터 검토가 쉬워야 한다.
- 앱과 웹은 같은 사용자 계정과 같은 데이터를 사용해야 한다.
- 초기 버전은 오픈뱅킹 없이 수동 입력 중심으로 구현한다.
- 추후 계좌 연동, 영수증 OCR, 자동 분류를 확장 가능한 구조로 설계한다.

## Tech Stack
- Monorepo with pnpm workspace
- apps/mobile: Expo + React Native + TypeScript
- apps/web: Next.js + TypeScript + Tailwind
- Backend: Supabase(Auth, Postgres, RLS, Storage)
- Shared packages: ui, types, config
- Form: react-hook-form + zod
- State/query: tanstack query
- Date/time: dayjs
- Charts: web/mobile 각각 적절한 안정적 라이브러리 사용

## Repository Expectations
- 먼저 전체 구조를 계획한 뒤 파일을 생성한다.
- 큰 작업은 바로 구현하지 말고 먼저 계획을 제시한다.
- 기존 구조와 충돌하는 새 의존성은 추가 전에 이유를 설명한다.
- 타입 에러를 남기지 않는다.
- 임시 mock 코드가 있으면 TODO와 제거 계획을 남긴다.
- 한국어 UI 문구를 기본으로 작성한다.
- 금액, 날짜, 통화 포맷은 한국 사용자 기준을 기본값으로 둔다.

## Architecture Rules
- 앱과 웹은 같은 도메인 모델을 공유한다.
- 비즈니스 규칙은 프론트에 중복 구현하지 말고 공통 모듈 또는 서버 규칙으로 정리한다.
- 화면 구현 전에 도메인 모델과 데이터 흐름을 먼저 정의한다.
- MVP에서는 다음 도메인을 우선 구현한다:
  - user
  - profile
  - account
  - category
  - transaction
  - budget
  - recurring_transaction
- transaction 타입은 최소한 income / expense / transfer 를 지원한다.
- 카테고리는 수입/지출 구분을 가져야 한다.
- 멀티 디바이스 동기화를 고려해 낙관적 UI와 서버 정합성을 함께 설계한다.

## UX Rules
- 모바일은 입력 속도와 한 손 사용성을 우선한다.
- 웹은 분석과 관리 효율을 우선한다.
- 첫 화면에서 이번 달 수지, 최근 내역, 빠른 입력 버튼이 보여야 한다.
- 삭제보다 soft delete 또는 복구 가능한 설계를 우선 검토한다.
- 빈 상태(empty state), 로딩 상태, 에러 상태를 반드시 구현한다.

## Coding Rules
- TypeScript strict mode 기준으로 작성한다.
- any 사용을 피한다.
- 컴포넌트와 훅을 역할별로 분리한다.
- 하드코딩 문자열은 상수화 가능한 경우 분리한다.
- 환경변수는 예시 파일과 함께 문서화한다.
- 민감정보는 코드에 직접 넣지 않는다.

## Testing and Verification
작업이 끝나면 가능한 범위에서 아래를 수행한다.
- 타입 체크
- lint
- 관련 테스트
- 핵심 사용자 흐름 수동 검증 방법 문서화

## Done Definition
작업 완료로 보려면 아래가 충족되어야 한다.
- 요구한 기능이 실제 코드에 반영됨
- 필요한 라우트/화면/컴포넌트/쿼리/스키마가 연결됨
- 타입 에러 없음
- 실행 방법과 검증 방법을 README 또는 관련 문서에 반영
- 다음 작업에 필요한 TODO가 명확히 정리됨

## Prompting Preference
작업을 시작할 때 아래 형식으로 응답한다.
1. 목표 요약
2. 구현 계획
3. 변경할 파일 목록 예상
4. 구현
5. 검증 결과
6. 남은 리스크

## Do Not
- 오픈뱅킹 연동을 초기 MVP에 강제로 넣지 말 것
- 과도한 마이크로서비스 구조로 가지 말 것
- 테스트 없이 핵심 로직을 끝났다고 판단하지 말 것
- 모바일 전용 UX를 웹에 그대로 복붙하지 말 것
