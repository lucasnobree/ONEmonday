import { SelfAssessmentFlow } from "@/components/hr/self-assessment-flow";

interface SelfAssessmentPageProps {
  params: Promise<{ cycleId: string }>;
}

export default async function SelfAssessmentPage({
  params,
}: SelfAssessmentPageProps) {
  const { cycleId } = await params;
  return <SelfAssessmentFlow cycleId={cycleId} />;
}
