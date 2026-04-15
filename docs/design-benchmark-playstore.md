# Play Store 가계부 앱 벤치마크 (웹 상용화 디자인 가이드)

기준일: 2026-04-15

## 벤치마크 대상
- Money Manager Expense & Budget (Realbyte)
- Wallet: Budget Expense Tracker (BudgetBakers)
- Spendee
- Money Lover
- 편한가계부

## 공통 UI 패턴
- 첫 화면에서 `이번 달 요약`을 숫자 카드로 즉시 노출
- `빠른 입력` CTA가 항상 눈에 띄는 위치에 있음
- 거래 목록은 필터/정렬/카테고리 태그 중심의 정보 밀도 높은 카드/테이블 조합
- 카테고리, 예산, 리포트가 서로 분리되어도 같은 정보 구조를 유지
- 브랜드 톤은 강한 장식보다 `신뢰감 + 가독성 + 속도`에 초점

## 우리 웹앱 반영 방향
- 홈 상단을 마케팅형 히어로 + 운영형 KPI 카드 조합으로 정리
- 대시보드/캘린더/관리/운영 흐름을 상단 요약 블록으로 안내
- 배경/카드/보더 톤을 상용 서비스형(저채도, 높은 명도, 명확한 대비)으로 조정
- 기존 기능(달력, 관리, 반복배치)은 유지하고 정보 구조만 상향

## 이번 변경 적용 범위
- `apps/web/app/page.tsx`
  - 상단 히어로를 상용 서비스 톤으로 개편
  - 핵심 가치 카드(요약/입력 속도/관리 효율) 추가
  - 기능 영역 안내 카드 4종(Dashboard/Calendar/Manage/Ops) 추가
- `apps/web/app/globals.css`
  - 컬러 토큰 및 그림자값을 상용화 톤으로 재조정
  - 배경 그라디언트를 신뢰형 톤으로 교체

## 주의사항
- 경쟁 앱의 고유 아이콘/레이아웃을 복제하지 않고 패턴만 참고
- 다음 단계에서 모바일(Expo)과 웹 토큰 일관성 동기화 필요

## 참고 링크
- https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree
- https://play.google.com/store/apps/details?id=com.droid4you.application.wallet
- https://play.google.com/store/apps/details?id=com.cleevio.spendee
- https://play.google.com/store/apps/details?id=com.bookmark.money
- https://play.google.com/store/search?q=%ED%8E%B8%ED%95%9C%EA%B0%80%EA%B3%84%EB%B6%80&c=apps
