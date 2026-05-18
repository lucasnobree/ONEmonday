import { SurveyAnswerFlow } from "@/components/hr/survey-answer-flow";

interface SurveyResponderPageProps {
  params: Promise<{ surveyId: string }>;
}

export default async function SurveyResponderPage({
  params,
}: SurveyResponderPageProps) {
  const { surveyId } = await params;
  return <SurveyAnswerFlow surveyId={surveyId} />;
}
