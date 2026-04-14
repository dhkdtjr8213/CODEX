"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import {
  buildMissingSupabaseEnvMessage,
  fetchLedgerOverviewCounts,
  signInWithGoogle,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  toAuthSessionSnapshot
} from "@household/supabase";
import type { AuthSessionSnapshot, LedgerOverviewCounts } from "@household/types";
import { getWebSupabaseBrowserClient } from "../lib/supabase/client";

const emptyCounts: LedgerOverviewCounts = {
  accounts: 0,
  categories: 0,
  transactions: 0,
  budgets: 0
};

interface AuthPanelProps {
  initialSnapshot: AuthSessionSnapshot;
}

export function AuthPanel({ initialSnapshot }: AuthPanelProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [snapshot, setSnapshot] = useState<AuthSessionSnapshot>(initialSnapshot);
  const [counts, setCounts] = useState<LedgerOverviewCounts>(emptyCounts);
  const [loading, setLoading] = useState(false);
  const [hasAuthClient, setHasAuthClient] = useState(initialSnapshot.hasEnv);

  useEffect(() => {
    const client = getWebSupabaseBrowserClient();

    if (!client) {
      setHasAuthClient(false);
      setMessage(buildMissingSupabaseEnvMessage("web"));
      return;
    }
    setHasAuthClient(true);

    const syncSession = async () => {
      const [{ data: sessionData }, { data: userData }] = await Promise.all([
        client.auth.getSession(),
        client.auth.getUser()
      ]);

      const nextSnapshot = toAuthSessionSnapshot("client", true, sessionData.session, userData.user);
      setSnapshot(nextSnapshot);

      if (nextSnapshot.isAuthenticated) {
        setCounts(await fetchLedgerOverviewCounts(client));
      } else {
        setCounts(emptyCounts);
      }
    };

    syncSession().catch((error: unknown) => {
      setMessage(
        error instanceof Error
          ? error.message
          : "세션 확인 중 오류가 발생했습니다."
      );
    });

    const {
      data: { subscription }
    } = client.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        const nextSnapshot = toAuthSessionSnapshot("client", true, session, session?.user ?? null);
        setSnapshot(nextSnapshot);

        if (nextSnapshot.isAuthenticated) {
          setCounts(await fetchLedgerOverviewCounts(client));
        } else {
          setCounts(emptyCounts);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    const client = getWebSupabaseBrowserClient();

    if (!client) {
      setMessage(buildMissingSupabaseEnvMessage("web"));
      return;
    }

    if (!email.trim() || !password) {
      setMessage("이메일과 비밀번호를 먼저 입력해 주세요.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await signInWithEmail(client, email, password);

    setLoading(false);
    setMessage(error ? error.message : "로그인에 성공했습니다.");
  };

  const handleSignUp = async () => {
    const client = getWebSupabaseBrowserClient();

    if (!client) {
      setMessage(buildMissingSupabaseEnvMessage("web"));
      return;
    }

    if (!email.trim() || !password) {
      setMessage("회원가입을 위해 이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setMessage("");

    const { error } = await signUpWithEmail(client, email, password, displayName);

    setLoading(false);
    setMessage(
      error
        ? error.message
        : "회원가입 요청을 보냈습니다. 이메일 확인 설정 여부에 따라 즉시 로그인되거나 인증 메일이 전송됩니다."
    );
  };

  const handleLogout = async () => {
    const client = getWebSupabaseBrowserClient();

    if (!client) {
      setMessage(buildMissingSupabaseEnvMessage("web"));
      return;
    }

    const { error } = await signOut(client);
    setMessage(error ? error.message : "로그아웃되었습니다.");
  };

  const handleGoogleLogin = async () => {
    const client = getWebSupabaseBrowserClient();

    if (!client) {
      setMessage(buildMissingSupabaseEnvMessage("web"));
      return;
    }

    setLoading(true);
    setMessage("");

    const redirectTo =
      typeof window !== "undefined" ? `${window.location.origin}/` : undefined;

    const { error } = await signInWithGoogle(client, redirectTo);

    if (error) {
      setLoading(false);
      setMessage(error.message);
      return;
    }

    setLoading(false);
    setMessage(
      "Google 로그인 창으로 이동합니다."
    );
  };

  return (
    <section className="rounded-[24px] bg-card p-6 shadow-sm">
      <div className="flex flex-col gap-4">
        <div>
          <h2 className="text-xl font-semibold">인증 상태</h2>
          <p className="mt-2 text-sm text-stone-600">
            {snapshot.isAuthenticated
              ? `${snapshot.email ?? "사용자"} 계정으로 로그인됨`
              : "로그인이 필요합니다."}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {"서버 초기 확인: "}
            {initialSnapshot.isAuthenticated
              ? "로그인됨"
              : "미로그인"}
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <input
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none"
            placeholder="이름(회원가입 시 선택)"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
          />
          <input
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none"
            placeholder="이메일"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <input
            className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none"
            placeholder="비밀번호"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            disabled={loading || !hasAuthClient}
            onClick={handleLogin}
            type="button"
          >
            이메일 로그인
          </button>
          <button
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-ink disabled:opacity-50"
            disabled={loading || !hasAuthClient}
            onClick={handleSignUp}
            type="button"
          >
            회원가입
          </button>
          <button
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-ink disabled:opacity-50"
            disabled={loading || !hasAuthClient}
            onClick={handleGoogleLogin}
            type="button"
          >
            Google 로그인
          </button>
          <button
            className="rounded-full border border-stone-300 px-5 py-3 text-sm font-medium text-ink disabled:opacity-50"
            disabled={loading || !hasAuthClient}
            onClick={handleLogout}
            type="button"
          >
            로그아웃
          </button>
        </div>

        {!hasAuthClient ? (
          <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
            웹 Supabase 환경변수가 없어 인증 버튼이 비활성화되었습니다. `apps/web/.env.local` 설정 후 다시 시도해 주세요.
          </p>
        ) : null}

        <div className="rounded-2xl bg-stone-100 p-4 text-sm text-stone-700">
          <p>{message || "이메일 로그인 중심의 기본 흐름이 준비되어 있습니다."}</p>
          <p className="mt-2">
            Google 로그인은 Supabase Auth 제공자 설정 이후 즉시 사용 가능합니다.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <CountCard label="계좌" value={counts.accounts} />
          <CountCard label="카테고리" value={counts.categories} />
          <CountCard label="거래" value={counts.transactions} />
          <CountCard label="예산" value={counts.budgets} />
        </div>
      </div>
    </section>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}
