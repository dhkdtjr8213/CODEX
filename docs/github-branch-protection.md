# GitHub main 보호 규칙 설정 가이드

대상 저장소: `dhkdtjr8213/CODEX`  
기준 브랜치: `main`

## 0) 자동 적용 스크립트 (권장)
로컬에서 아래 순서로 실행하면 GitHub API로 보호 규칙을 적용할 수 있습니다.

1. `.env` 또는 쉘 환경에 `GITHUB_TOKEN` 설정
   - 권한: 저장소 관리(Administration: write) + Metadata read
2. dry-run 확인
   - `pnpm ops:github:protect-main:dry`
3. 실제 적용
   - `pnpm ops:github:protect-main`

기본 대상:
- owner: `dhkdtjr8213`
- repo: `CODEX`
- branch: `main`

필요 시 아래 env로 오버라이드:
- `GITHUB_REPO_OWNER`
- `GITHUB_REPO_NAME`
- `GITHUB_PROTECTED_BRANCH`

## 1) 보호 규칙 생성
1. GitHub 저장소 > `Settings` > `Branches` 이동
2. `Add branch protection rule` 클릭
3. `Branch name pattern`에 `main` 입력

## 2) 필수 옵션
- `Require a pull request before merging` 활성화
- `Require approvals` 최소 1명
- `Dismiss stale pull request approvals when new commits are pushed` 활성화
- `Require status checks to pass before merging` 활성화
  - Required checks 등록:
    - `Typecheck`
    - `Lint`
    - `Smoke`
- `Restrict who can push to matching branches` 활성화
  - 직접 push 권한은 운영 관리자만 최소화

## 3) 권장 옵션
- `Require conversation resolution before merging` 활성화
- `Do not allow bypassing the above settings` 활성화
- `Require linear history`는 팀 정책에 맞춰 선택

## 4) 적용 확인 방법
1. 기능 브랜치에서 PR 생성
2. CI 실패 상태에서 merge 차단 확인
3. 직접 `main` push 시 차단 확인
4. CI 통과 후 PR merge 정상 확인

## 5) 운영 팁
- 긴급 배포가 필요해도 직접 `main` push 대신 hotfix PR 경로를 유지합니다.
- 브랜치 보호 규칙 변경 이력은 팀 채널에 공지하고 문서에 날짜를 남깁니다.
