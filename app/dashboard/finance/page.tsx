"use client";
import { PageTabs } from "@/components/PageTabs";
import DiscountsPage from "@/app/dashboard/discounts/page";
import ExpensesPage from "@/app/dashboard/expenses/page";
import DayClosePage from "@/app/dashboard/day-close/page";

export default function FinancePage() {
  return (
    <PageTabs tabs={[
      { id: "discounts", label: "Discounts",  icon: "🏷️" },
      { id: "expenses",  label: "Expenses",   icon: "💸" },
      { id: "dayclose",  label: "Day Close",  icon: "🔒" },
    ]}>
      {tab =>
        tab === "expenses"  ? <ExpensesPage />  :
        tab === "dayclose"  ? <DayClosePage  /> :
        <DiscountsPage />
      }
    </PageTabs>
  );
}
