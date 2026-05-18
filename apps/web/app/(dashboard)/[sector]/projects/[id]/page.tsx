import { ProjectDetail } from "@/components/projects/project-detail";

interface ProjectDetailPageProps {
  params: Promise<{ sector: string; id: string }>;
}

export default async function ProjectDetailPage({
  params,
}: ProjectDetailPageProps) {
  const { sector, id } = await params;
  return <ProjectDetail projectId={id} sectorSlug={sector} />;
}
