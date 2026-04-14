# 현재 진행 상황

기준일: 2026-04-13

## 완료
- Supabase Auth 기반으로 앱/웹이 같은 계정을 공유하는 방향을 확정함
- 거래 타입 `income`, `expense`, `transfer` 기준을 정리함
- 계정, 카테고리, 거래, 예산, 반복 거래 도메인 뼈대를 반영함
- `ops:check-env`, `smoke`, `smoke:with-env`, `ops:preflight` 운영 명령을 문서와 스크립트에 연결함
- 반복 거래 자동 실행 배치 검증용 `pnpm ops:check-recurring-batch`를 추가함
- 웹 관리 기능 범위와 거래 검색/내보내기 기준을 문서화함
- 모바일 홈에 반복거래 실행 로그 섹션을 추가하고, 최근 로그를 더 컴팩트한 형태로 개선함
- 웹 반복배치 실행 로그 패널에 최근 7일 성공/실패/마지막 실행시각 요약을 추가함
- 웹 반복배치 실행 로그 패널에 최근 7일 실패 사유 요약(상위 사유 집계)을 추가함
- 모바일 반복거래 실행 로그 섹션에 최근 7일 성공/실패 건수 요약을 추가함
- 웹 반복배치 실행 로그 패널에 총 누적 성공/실패 요약과 실패 로그 상세 펼침 UI를 추가함
- 모바일 반복거래 실행 로그 섹션에 총 누적 성공/실패 건수 요약을 추가함
- 웹 실패 로그 상세를 최근 5건 우선 노출하고 전체 펼침으로 확장할 수 있게 개선함
- 모바일 실행 요약 줄을 2줄 구조로 정리해 작은 화면 줄바꿈 안정성을 개선함
- 웹 실패 로그 상세에 사유 검색 필터를 추가함
- 모바일 반복거래 로그 카드 탭 시 상세 모달(상태/사유)을 확인할 수 있게 개선함
- 웹 실패 로그 상세에 기간/사유상태 필터를 추가해 문제 로그 탐색성을 개선함
- 모바일 실행 상세 모달에 사유 공유 버튼을 추가함
- 웹 실패 로그 필터 상태를 로컬에 저장해 재방문 시 유지되도록 개선함
- 웹 실패 로그 필터를 URL 파라미터와 동기화해 공유/새로고침 복원을 지원함
- 모바일 상세 공유 메시지에 로그 ID/예약시각/실행시각을 포함하도록 개선함
- 기능 매뉴얼(`docs/feature-manual.md`)을 UTF-8 한국어 기준으로 재정리함

## 진행 중
- 운영 환경변수 정리와 배포 전 검증 기준 고정
- 반복 거래 배치의 실제 실행 경로와 dry-run 정합성 확인
- 모바일 빠른 입력 UX와 웹 관리 화면의 데이터 연결 보강
- 모바일 관리 화면에 프로필 설정(표시 이름/주 시작일/월 시작일) 저장 흐름 연결
- 예산/카테고리/거래 목록의 세부 흐름 점검

## 오늘 할 일
1. `pnpm ops:check-env`로 필수 환경변수 누락 여부를 재확인한다.
2. `pnpm smoke`와 `pnpm smoke:with-env` 실행 조건을 정리한다.
3. `pnpm ops:check-recurring-batch`로 반복 거래 dry-run 결과를 확인한다.
4. Supabase Auth redirect URL과 운영 도메인 설정을 다시 점검한다.
5. 모바일/웹에서 같은 계정 동기화가 유지되는지 확인한다.

## 검증 순서
1. Supabase 마이그레이션을 적용한다.
2. 웹과 모바일이 같은 Supabase 프로젝트를 바라보는지 확인한다.
3. `pnpm ops:check-env`를 실행한다.
4. `pnpm smoke`로 기본 연결을 확인한다.
5. 필요하면 `pnpm smoke:with-env`로 운영 변수 포함 검증을 수행한다.
6. 웹과 모바일에서 같은 계정으로 로그인한다.
7. 모바일에서 수입/지출/이체를 각각 1건씩 입력한다.
8. 웹에서 동일 데이터가 보이는지 확인한다.
9. 예산, 카테고리, 반복 거래 수정 흐름을 점검한다.
10. `pnpm ops:check-recurring-batch`로 배치 dry-run을 확인한다.

## 차단 이슈
- 운영 env 미설정으로 `pnpm smoke:with-env`와 `pnpm ops:preflight`가 실패할 수 있음
- 누락 가능 변수
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `CRON_SECRET`
- 세부 가이드: [runtime-env-setup.md](./runtime-env-setup.md)

## 메모
- 반복 거래 자동 실행은 오픈뱅킹 없이도 MVP 범위에서 운영 가능하게 유지한다.
- 앱과 웹은 같은 인증, 같은 DB, 같은 도메인 모델을 공유한다.
- 새 기능은 화면보다 먼저 데이터 흐름과 운영 검증 경로를 맞춘다.
- 진행률 자동 산정은 `pnpm ops:progress`로 확인한다.
- 운영 준비 점검은 `pnpm ops:ready`(로컬), `pnpm ops:ready:full`(env/배치 포함)로 확인한다.
- 현재 기능 매뉴얼: [feature-manual.md](./feature-manual.md)
