# 가계부 앱 레퍼런스 리뷰 (2026-04-15)

## 조사 범위
- Android (Google Play) 상위권/인기 가계부 앱 5개
- iOS (App Store) 상위권/인기 예산/가계부 앱 5개

## Android 레퍼런스 5
1. Money Manager Expense & Budget
- https://play.google.com/store/apps/details?id=com.realbyteapps.moneymanagerfree
2. Wallet: Budget Expense Tracker
- https://play.google.com/store/apps/details?id=com.droid4you.application.wallet
3. Spendee
- https://play.google.com/store/apps/details?id=com.cleevio.spendee
4. Monefy
- https://play.google.com/store/apps/details?id=com.monefy.app.lite
5. Money Lover
- https://play.google.com/store/apps/details?id=com.bookmark.money

## iOS 레퍼런스 5
1. Money Lover: Expense Manager
- https://apps.apple.com/us/app/money-lover-expense-manager/id486312413
2. YNAB
- https://apps.apple.com/us/app/ynab/id1010865877
3. Goodbudget Budget Planner
- https://apps.apple.com/us/app/goodbudget-budget-planner/id471112395
4. Rocket Money
- https://apps.apple.com/us/app/rocket-money-bills-budgets/id1130616675
5. PocketGuard
- https://apps.apple.com/us/app/pocketguard-money-budgeting/id949414211

## 공통적으로 잘하는 기능 (교집합)
- 첫 진입에서 바로 보이는 `빠른 입력` 흐름
- 계정/카테고리 기본 템플릿 제공으로 초기 설정 피로 감소
- 월간 요약 카드 + 카테고리 소비 비중 + 예산 진행률의 3단 구성
- 필터/정렬/검색/내보내기 등 검토 생산성 기능 강화
- 반복 지출(고정비) 분리 관리

## 디자인 관찰 포인트
- 정보 계층이 명확한 카드형 대시보드
- 액션 버튼은 원형/필형으로 일관성 있게 처리
- 입력 필드는 대비가 분명하고 포커스 상태가 확실함
- 상태 메시지(성공/실패/빈 상태)를 눈에 띄게 제공

## 우리 웹앱 반영 결과
- 완료:
  - 상단 히어로/요약 카드 상용화 톤 반영
  - 워크스페이스(대시보드/거래/관리/설정) 표면/폼/필터 스타일 통일
  - 거래 검토 영역 카드/테이블/필터바 가독성 개선
  - 관리 영역 사이드 메뉴/상태 패널 시각 구조 개선
  - `스타터 팩` 기능 추가
    - 계정/카테고리 추천 템플릿 원클릭 생성
    - 최초 로그인 후 데이터가 비어 있으면 자동 1회 생성

- 이번 스타터 팩 기본값:
  - 계정: 현금지갑, 생활비 통장, 주거래 카드, 비상금 통장, 투자 계좌
  - 카테고리(수입/지출): 월급, 부수입, 이자/배당, 환급/캐시백, 식비, 카페/간식, 교통, 주거/관리비, 통신, 쇼핑, 의료/건강, 구독, 여가/취미, 교육, 경조사, 기타

## 다음 추천 반영 (우선순위)
1. 거래 입력 `최근 사용 템플릿` (최근 5개 자동 제안)
2. 월간 인사이트 카드 (예산 초과 상위 3개 카테고리 자동 표시)
3. 모바일(Expo) 화면에도 동일한 스타터 팩/톤 동기화
