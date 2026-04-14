import { useEffect, useMemo, useState } from "react";
import dayjs from "dayjs";
import type { Category, LedgerSnapshot } from "@household/types";
import { formatCurrency } from "@household/ui";

type TransactionItem = LedgerSnapshot["transactions"][number];

function buildCalendarDays(monthKey: string) {
  const monthStart = dayjs(`${monthKey}-01`).startOf("month");
  const offset = (monthStart.day() + 6) % 7;
  const firstCellDate = monthStart.subtract(offset, "day");

  return Array.from({ length: 42 }, (_, index) => firstCellDate.add(index, "day"));
}

function getTransactionTypeLabel(type: TransactionItem["type"]) {
  if (type === "income") return "수입";
  if (type === "expense") return "지출";
  return "이체";
}

const weekLabels = ["월", "화", "수", "목", "금", "토", "일"];

export function MonthlyCalendarPanel({
  categories,
  transactions,
  loading,
  onEdit,
  onDelete
}: {
  categories: Category[];
  transactions: TransactionItem[];
  loading: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [monthKey, setMonthKey] = useState(dayjs().format("YYYY-MM"));
  const [selectedDateKey, setSelectedDateKey] = useState(dayjs().format("YYYY-MM-DD"));
  const [detailSearch, setDetailSearch] = useState("");
  const todayKey = dayjs().format("YYYY-MM-DD");

  const monthDays = useMemo(() => buildCalendarDays(monthKey), [monthKey]);
  const currentMonthLabel = dayjs(`${monthKey}-01`).format("YYYY년 M월");

  const monthTransactions = useMemo(
    () =>
      transactions.filter((item) =>
        dayjs(item.occurredAt).isSame(dayjs(`${monthKey}-01`), "month")
      ),
    [monthKey, transactions]
  );
  const monthSummary = useMemo(() => {
    let income = 0;
    let expense = 0;
    let transfer = 0;

    for (const item of monthTransactions) {
      if (item.type === "income") {
        income += item.amount;
      } else if (item.type === "expense") {
        expense += item.amount;
      } else {
        transfer += item.amount;
      }
    }

    return {
      income,
      expense,
      transfer,
      balance: income - expense,
      count: monthTransactions.length
    };
  }, [monthTransactions]);

  const transactionByDate = useMemo(() => {
    const map = new Map<string, TransactionItem[]>();

    for (const item of monthTransactions) {
      const key = dayjs(item.occurredAt).format("YYYY-MM-DD");
      const bucket = map.get(key) ?? [];
      bucket.push(item);
      map.set(key, bucket);
    }

    for (const [key, bucket] of map.entries()) {
      map.set(
        key,
        [...bucket].sort((left, right) => dayjs(right.occurredAt).valueOf() - dayjs(left.occurredAt).valueOf())
      );
    }

    return map;
  }, [monthTransactions]);

  const categoryColorMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.color])),
    [categories]
  );

  const selectedItems = useMemo(
    () => transactionByDate.get(selectedDateKey) ?? [],
    [selectedDateKey, transactionByDate]
  );
  const filteredSelectedItems = useMemo(() => {
    const query = detailSearch.trim().toLowerCase();
    if (!query) {
      return selectedItems;
    }

    return selectedItems.filter((item) => {
      const text = [
        item.description ?? "",
        item.categoryName ?? "",
        item.accountName ?? "",
        getTransactionTypeLabel(item.type)
      ]
        .join(" ")
        .toLowerCase();
      return text.includes(query);
    });
  }, [detailSearch, selectedItems]);

  useEffect(() => {
    const isSameMonth = dayjs(selectedDateKey).isSame(dayjs(`${monthKey}-01`), "month");
    if (isSameMonth) {
      return;
    }

    setSelectedDateKey(dayjs(`${monthKey}-01`).format("YYYY-MM-DD"));
  }, [monthKey, selectedDateKey]);

  const moveSelectionByDays = (days: number) => {
    const nextKey = dayjs(selectedDateKey).add(days, "day").format("YYYY-MM-DD");
    setSelectedDateKey(nextKey);
    setMonthKey(dayjs(nextKey).format("YYYY-MM"));
  };

  return (
    <section className="rounded-[24px] border border-[color:var(--border)] bg-[color:var(--card-strong)] p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted-foreground)]">
            {"Calendar"}
          </p>
          <h3 className="mt-1 text-xl font-semibold text-[color:var(--foreground)]">
            {currentMonthLabel}
          </h3>
        </div>
        <div className="flex gap-2">
          <button
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm"
            onClick={() => {
              const nextMonth = dayjs().format("YYYY-MM");
              setMonthKey(nextMonth);
              setSelectedDateKey(dayjs().format("YYYY-MM-DD"));
            }}
            type="button"
          >
            {"이번 달"}
          </button>
          <button
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm"
            onClick={() => setMonthKey(dayjs(`${monthKey}-01`).subtract(1, "month").format("YYYY-MM"))}
            type="button"
          >
            {"이전 달"}
          </button>
          <button
            className="rounded-full border border-stone-300 bg-white px-4 py-2 text-sm"
            onClick={() => setMonthKey(dayjs(`${monthKey}-01`).add(1, "month").format("YYYY-MM"))}
            type="button"
          >
            {"다음 달"}
          </button>
        </div>
      </div>

      {loading ? (
        <p className="mt-4 rounded-2xl bg-stone-100 px-4 py-3 text-sm text-stone-600">
          {"달력 데이터를 불러오는 중입니다."}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p className="text-xs text-emerald-700">{"이번 달 수입"}</p>
          <p className="mt-1 text-base font-semibold text-emerald-800">{formatCurrency(monthSummary.income)}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3">
          <p className="text-xs text-rose-700">{"이번 달 지출"}</p>
          <p className="mt-1 text-base font-semibold text-rose-800">{formatCurrency(monthSummary.expense)}</p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3">
          <p className="text-xs text-sky-700">{"수지"}</p>
          <p className="mt-1 text-base font-semibold text-sky-800">{formatCurrency(monthSummary.balance)}</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
          <p className="text-xs text-stone-500">{"거래 건수"}</p>
          <p className="mt-1 text-base font-semibold text-stone-800">{`${monthSummary.count}건`}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white p-3 sm:p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-2xl bg-[color:var(--surface-soft)] px-3 py-2 text-xs text-stone-600">
            <span className="font-medium text-stone-700">{"범례"}</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {"수입"}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-rose-500" />
              {"지출"}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-sky-500" />
              {"이체"}
            </span>
          </div>
          <div className="min-w-[760px]">
            <div className="grid grid-cols-7 gap-2">
              {weekLabels.map((label, index) => (
                <div
                  key={label}
                  className={`rounded-xl bg-[color:var(--surface-soft)] px-2 py-2 text-center text-xs font-semibold ${
                    index === 5
                      ? "text-blue-600"
                      : index === 6
                        ? "text-rose-600"
                        : "text-[color:var(--muted-foreground)]"
                  }`}
                >
                  {label}
                </div>
              ))}
            </div>

            <div
              className="mt-2 grid grid-cols-7 gap-2"
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  event.preventDefault();
                  moveSelectionByDays(-1);
                } else if (event.key === "ArrowRight") {
                  event.preventDefault();
                  moveSelectionByDays(1);
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  moveSelectionByDays(-7);
                } else if (event.key === "ArrowDown") {
                  event.preventDefault();
                  moveSelectionByDays(7);
                }
              }}
              tabIndex={0}
            >
              {monthDays.map((date) => {
                const dateKey = date.format("YYYY-MM-DD");
                const items = transactionByDate.get(dateKey) ?? [];
                const income = items
                  .filter((item) => item.type === "income")
                  .reduce((sum, item) => sum + item.amount, 0);
                const expense = items
                  .filter((item) => item.type === "expense")
                  .reduce((sum, item) => sum + item.amount, 0);
                const transferCount = items.filter((item) => item.type === "transfer").length;
                const categoryDots = items
                  .map((item) => item.categoryId)
                  .filter((value): value is string => Boolean(value))
                  .map((categoryId) => categoryColorMap.get(categoryId))
                  .filter((value): value is string => Boolean(value))
                  .filter((value, index, array) => array.indexOf(value) === index)
                  .slice(0, 3);
                const isCurrentMonth = date.isSame(dayjs(`${monthKey}-01`), "month");
                const isSelected = selectedDateKey === dateKey;
                const isToday = todayKey === dateKey;
                const weekIndex = date.day();
                const isSunday = weekIndex === 0;
                const isSaturday = weekIndex === 6;

                return (
                  <button
                    key={dateKey}
                    aria-label={`${date.format("M월 D일")} 수입 ${formatCurrency(
                      income
                    )}, 지출 ${formatCurrency(expense)}, 이체 ${transferCount}건`}
                    className={`min-h-[106px] rounded-2xl border p-2 text-left transition ${
                      isSelected
                        ? "border-[color:var(--point)] bg-[color:var(--point-soft)] shadow-[0_10px_24px_rgba(21,93,73,0.13)]"
                        : "border-stone-200 bg-white hover:border-stone-300"
                    } ${isCurrentMonth ? "" : "opacity-45"} ${isToday ? "ring-1 ring-amber-300" : ""}`}
                    onClick={() => setSelectedDateKey(dateKey)}
                    title={`수입 ${formatCurrency(income)} · 지출 ${formatCurrency(expense)} · 이체 ${transferCount}건`}
                    type="button"
                  >
                    <p
                      className={`text-xs font-semibold ${
                        isSunday
                          ? "text-rose-600"
                          : isSaturday
                            ? "text-blue-600"
                            : "text-stone-600"
                      }`}
                    >
                      {date.date()}
                    </p>
                    {income > 0 ? (
                      <p className="mt-1 truncate text-[11px] text-emerald-700">
                        {`+ ${formatCurrency(income)}`}
                      </p>
                    ) : null}
                    {expense > 0 ? (
                      <p className="mt-1 truncate text-[11px] text-rose-700">
                        {`- ${formatCurrency(expense)}`}
                      </p>
                    ) : null}
                    {transferCount > 0 ? (
                      <p className="mt-1 truncate text-[11px] text-sky-700">{`이체 ${transferCount}건`}</p>
                    ) : null}
                    {categoryDots.length ? (
                      <div className="mt-2 flex gap-1">
                        {categoryDots.map((color, index) => (
                          <span
                            key={`${dateKey}-dot-${index}`}
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          {!monthSummary.count ? (
            <p className="mt-3 rounded-2xl bg-stone-100 px-3 py-3 text-sm text-stone-600">
              {"이번 달 거래가 아직 없습니다. 오른쪽 관리 탭에서 빠르게 입력해보세요."}
            </p>
          ) : null}
        </div>

        <aside className="rounded-2xl border border-stone-200 bg-white p-4 transition-all duration-300 ease-out lg:sticky lg:top-6">
          <p className="text-sm font-semibold text-[color:var(--foreground)]">
            {`${dayjs(selectedDateKey).format("YYYY년 M월 D일")} 거래`}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {"날짜를 바꿔가며 거래 흐름을 빠르게 점검하세요."}
          </p>

          <input
            className="mt-3 w-full rounded-xl border border-stone-200 px-3 py-2 text-sm"
            onChange={(event) => setDetailSearch(event.target.value)}
            placeholder="메모/카테고리 검색"
            value={detailSearch}
          />

          {!filteredSelectedItems.length ? (
            <p className="mt-3 rounded-xl bg-stone-100 px-3 py-3 text-sm text-stone-600">
              {"조건에 맞는 거래가 없습니다."}
            </p>
          ) : (
            <div className="mt-3 flex max-h-[520px] flex-col gap-2 overflow-y-auto pr-1">
              {filteredSelectedItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-stone-200 px-3 py-3 transition-transform duration-300 ease-out hover:-translate-y-0.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--foreground)]">
                        {item.description || item.categoryName || "설명 없음"}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            item.type === "income"
                              ? "bg-emerald-50 text-emerald-700"
                              : item.type === "expense"
                                ? "bg-rose-50 text-rose-700"
                                : "bg-sky-50 text-sky-700"
                          }`}
                        >
                          {getTransactionTypeLabel(item.type)}
                        </span>
                        <span className="text-xs text-stone-500">{item.accountName ?? "계정 없음"}</span>
                        {item.categoryId ? (
                          <span className="inline-flex items-center gap-1 text-xs text-stone-500">
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  categoryColorMap.get(item.categoryId) ?? "#94a3b8"
                              }}
                            />
                            {item.categoryName ?? "카테고리"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <p
                      className={`text-sm font-semibold ${
                        item.type === "income"
                          ? "text-emerald-700"
                          : item.type === "expense"
                            ? "text-rose-700"
                            : "text-sky-700"
                      }`}
                    >
                      {formatCurrency(item.amount)}
                    </p>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="rounded-full border border-stone-300 px-3 py-1 text-xs"
                      onClick={() => onEdit(item.id)}
                      type="button"
                    >
                      {"수정"}
                    </button>
                    <button
                      className="rounded-full border border-rose-200 px-3 py-1 text-xs text-rose-700"
                      onClick={() => onDelete(item.id)}
                      type="button"
                    >
                      {"삭제"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
