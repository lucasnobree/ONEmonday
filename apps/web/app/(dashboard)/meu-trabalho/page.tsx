import type { Metadata } from "next";
import { MyWorkView } from "@/components/my-work/my-work-view";

export const metadata: Metadata = {
  title: "Meu Trabalho",
};

/**
 * "Meu Trabalho" — a personal cross-board task view (Monday.com "My Work").
 * Lists every card assigned to the signed-in user across all sectors and
 * boards, grouped by due date. Reachable for everyone via the sidebar; it is
 * also the role-based landing for individual contributors.
 */
export default function MeuTrabalhoPage() {
  return <MyWorkView />;
}
