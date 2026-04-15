import { APP_NAME } from "@household/config";
import { AuthPanel } from "../components/auth-panel";
import { LedgerWorkspace } from "../components/ledger-workspace";
import { getWebServerSessionSnapshot } from "../lib/supabase/server";

function getSupabaseStatus(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
    ? "Supabase 연결 준비 완료"
    : "Supabase 환경변수 확인 필요";
}

export default async function HomePage() {
  const initialSnapshot = await getWebServerSessionSnapshot();

  return (
    <main className="min-h-screen bg-transparent px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 sm:gap-8">
        <section className="rounded-[34px] border border-white/55 bg-[linear-gradient(128deg,#0f6c66_0%,#0a5d78_56%,#104a63_100%)] p-6 text-white shadow-[var(--shadow-hero)] ring-1 ring-white/15 sm:p-8">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/75">
                {"Household Ledger Web"}
              </p>
              <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                {APP_NAME}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-white/85 sm:text-base">
                {"구글플레이 상위 가계부 앱의 핵심 패턴처럼, 이번 달 수지와 최근 거래를 한 화면에서 빠르게 확인하고 바로 입력까지 이어집니다."}
              </p>
              <div className="mt-6 flex flex-wrap gap-2 text-sm text-white/90">
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                  {"빠른 거래 입력"}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                  {"월별 통계 대시보드"}
                </span>
                <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 backdrop-blur-sm">
                  {getSupabaseStatus()}
                </span>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs text-white/70">{"핵심 요약"}</p>
                <p className="mt-2 text-lg font-semibold">{"이번 달 수지 한눈에"}</p>
                <p className="mt-1 text-xs text-white/75">{"수입, 지출, 잔액 카드 요약 제공"}</p>
              </article>
              <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs text-white/70">{"입력 속도"}</p>
                <p className="mt-2 text-lg font-semibold">{"5초 빠른 기록"}</p>
                <p className="mt-1 text-xs text-white/75">{"최근 패턴 기반 즉시 입력 흐름"}</p>
              </article>
              <article className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                <p className="text-xs text-white/70">{"관리 효율"}</p>
                <p className="mt-2 text-lg font-semibold">{"카테고리·예산 분리 관리"}</p>
                <p className="mt-1 text-xs text-white/75">{"웹에서 검토/정리 작업 최적화"}</p>
              </article>
            </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{"Dashboard"}</p>
            <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{"수지 카드 + 트렌드 + 예산 진척"}</p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{"Calendar"}</p>
            <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{"날짜별 거래 탐색과 빠른 수정"}</p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{"Manage"}</p>
            <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{"계정/카테고리/예산 통합 관리"}</p>
          </article>
          <article className="rounded-2xl border border-[var(--border)] bg-[var(--card-strong)] p-4 shadow-[var(--shadow-soft)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted-foreground)]">{"Ops"}</p>
            <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{"반복 배치 로그와 운영 점검 연동"}</p>
          </article>
        </section>

        <AuthPanel initialSnapshot={initialSnapshot} />

        <LedgerWorkspace initialSnapshot={initialSnapshot} />
      </div>
    </main>
  );
}
