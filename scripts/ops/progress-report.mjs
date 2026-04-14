const CHECKLIST = [
  {
    domain: "user",
    title: "사용자/인증",
    items: [
      { label: "앱/웹 공통 Supabase Auth 기반 연결", done: true },
      { label: "로그인/가입 흐름의 운영 전제 정리", done: true }
    ]
  },
  {
    domain: "profile",
    title: "프로필",
    items: [
      { label: "프로필 도메인 모델 연결", done: true },
      { label: "프로필 설정 화면/편집 흐름", done: true }
    ]
  },
  {
    domain: "account",
    title: "계정",
    items: [
      { label: "계정 도메인 모델 연결", done: true },
      { label: "계정 생성/수정/삭제 관리 흐름", done: true }
    ]
  },
  {
    domain: "category",
    title: "카테고리",
    items: [
      { label: "수입/지출 카테고리 구분 기준", done: true },
      { label: "카테고리 관리 화면", done: true }
    ]
  },
  {
    domain: "transaction",
    title: "거래",
    items: [
      { label: "income / expense / transfer 거래 타입 기준", done: true },
      { label: "빠른 입력 및 수정 흐름", done: true }
    ]
  },
  {
    domain: "budget",
    title: "예산",
    items: [
      { label: "예산 도메인 모델 연결", done: true },
      { label: "예산 관리 화면", done: true }
    ]
  },
  {
    domain: "recurring_transaction",
    title: "반복 거래",
    items: [
      { label: "반복 거래 dry-run 배치 검증", done: true },
      { label: "반복 거래 실행 로그/운영 흐름", done: true }
    ]
  },
  {
    domain: "ops",
    title: "운영/검증",
    items: [
      { label: "env / smoke / preflight 운영 스크립트", done: true },
      { label: "진행률 자동 산정 명령 연결", done: true }
    ]
  }
];

const countDone = (items) => items.reduce((sum, item) => sum + (item.done ? 1 : 0), 0);

const countTotal = (items) => items.length;

const totalDone = CHECKLIST.reduce((sum, domain) => sum + countDone(domain.items), 0);
const totalCount = CHECKLIST.reduce((sum, domain) => sum + countTotal(domain.items), 0);
const totalPercent = totalCount === 0 ? 0 : Math.round((totalDone / totalCount) * 100);

console.log("Ops progress report");
console.log(`- overall: ${totalDone}/${totalCount} (${totalPercent}%)`);
console.log("- rule: each checklist item has equal weight");

for (const domain of CHECKLIST) {
  const doneCount = countDone(domain.items);
  const total = countTotal(domain.items);
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  console.log(`\n[${domain.domain}] ${domain.title}`);
  console.log(`- progress: ${doneCount}/${total} (${percent}%)`);

  for (const item of domain.items) {
    console.log(`  - ${item.done ? "done" : "pending"}: ${item.label}`);
  }
}
