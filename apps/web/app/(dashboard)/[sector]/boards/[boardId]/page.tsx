import { BoardView } from "@/components/boards/board-view";
import { createClient } from "@/lib/supabase/server";

interface BoardPageProps {
  params: Promise<{ sector: string; boardId: string }>;
}

export default async function BoardPage({ params }: BoardPageProps) {
  const { sector, boardId } = await params;

  const supabase = await createClient();
  const { data: sectorData } = await supabase
    .from("sectors")
    .select("id")
    .eq("slug", sector)
    .single();

  if (!sectorData) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        Setor nao encontrado.
      </div>
    );
  }

  return <BoardView boardId={boardId} sectorId={sectorData.id} />;
}
