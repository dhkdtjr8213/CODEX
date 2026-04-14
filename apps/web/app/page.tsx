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
      <div className="mx-auto flex max-w-7xl flex-col gap-7 sm:gap-8">
        <section className="rounded-[36px] border border-white/15 bg-[linear-gradient(128deg,rgba(23,98,74,0.98)_0%,rgba(24,106,113,0.96)_58%,rgba(20,83,67,0.96)_100%)] p-6 text-white shadow-[var(--shadow-hero)] ring-1 ring-white/10 sm:p-8">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-white/75">
            {"Household Ledger Web"}
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
            {APP_NAME}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/84 sm:text-base">
            {"월별 달력 기반 거래 검토, 탭형 관리 화면, 운영 점검 흐름을 분리해 실사용자 기준으로 빠르고 깔끔하게 관리합니다."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-sm text-white/90">
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {"월별 달력 입출금"}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {"사이드 메뉴 워크스페이스"}
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-4 py-2 backdrop-blur-sm">
              {getSupabaseStatus()}
            </span>
          </div>
        </section>

        <AuthPanel initialSnapshot={initialSnapshot} />

        <LedgerWorkspace initialSnapshot={initialSnapshot} />
      </div>
    </main>
  );
}
