# 예산, 반복지출, 월별 통계 설계 메모

## 범위

- `budget`: 월별 카테고리 예산
- `recurring_transaction`: 매월 반복되는 고정 지출/수입/이체 정의
- `monthly stats`: 월 요약, 카테고리별 지출 비중, 예산 진행률

## 앱과 웹 역할

- 모바일: 예산 진행률 요약, 반복지출 요약, 간단 등록/수정
- 웹: 카테고리별 소비 비중, 예산 진행률, 반복지출 관리

## 자동 반복 생성 처리

이번 MVP에서는 `recurring_transactions`를 등록하고 관리하는 기본 흐름까지만 구현합니다.

### 현재 구현

- 반복 지출 등록/수정
- 다음 실행일 보관
- 웹/모바일 화면에서 목록 확인

### TODO

- Supabase Edge Function 또는 cron 기반 배치에서 `next_run_at <= now()` 조건의 항목을 실행
- 실행 시 `transactions` 레코드 생성
- 성공 후 `next_run_at` 을 다음 월로 이동
- 중복 생성 방지를 위해 execution log 테이블 추가 검토

## 차트 교체 전략

통계 데이터는 현재 `packages/supabase/src/ledger.ts`의 `fetchMonthlyStats()`에서 도메인 데이터 형태로 만듭니다.
따라서 차트 라이브러리를 바꾸더라도 UI 레이어에서만 교체하면 됩니다.
