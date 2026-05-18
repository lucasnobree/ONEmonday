import { RecruitmentBoard } from "@/components/hr/recruitment-board";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { Briefcase } from "lucide-react";

interface RecruitmentBoardPageProps {
  params: Promise<{ openingId: string }>;
}

export default async function RecruitmentBoardPage({
  params,
}: RecruitmentBoardPageProps) {
  const { openingId } = await params;

  const supabase = await createClient();
  const { data: opening } = await supabase
    .from("hr_job_openings")
    .select("id, title, sector_id")
    .eq("id", openingId)
    .maybeSingle();

  if (!opening) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Vaga não encontrada"
        description="A vaga que você procura não existe ou não está mais disponível."
      />
    );
  }

  return (
    <RecruitmentBoard
      openingId={opening.id}
      openingTitle={opening.title}
      sectorId={opening.sector_id}
    />
  );
}
