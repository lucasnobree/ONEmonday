import { z } from "zod";

export const createEmployeeSchema = z.object({
  sectorId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  fullName: z.string().min(1, "Nome é obrigatório").max(200),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  position: z.string().min(1, "Cargo é obrigatório"),
  department: z.string().optional(),
  hireDate: z.string().min(1, "Data de admissão é obrigatória"),
  birthDate: z.string().optional(),
  managerId: z.string().uuid().optional(),
  employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]).default("full_time"),
});

export const requestTimeOffSchema = z.object({
  employeeId: z.string().uuid(),
  sectorId: z.string().uuid(),
  policyId: z.string().uuid(),
  startDate: z.string().min(1, "Data de início é obrigatória"),
  endDate: z.string().min(1, "Data de fim é obrigatória"),
  daysCount: z.number().int().min(1),
  reason: z.string().optional(),
});

export const createJobOpeningSchema = z.object({
  sectorId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  department: z.string().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
  employmentType: z.enum(["full_time", "part_time", "contractor", "intern"]).default("full_time"),
  location: z.string().optional(),
  salaryRange: z.string().optional(),
  hiringManagerId: z.string().uuid().optional(),
  maxCandidates: z.number().int().min(1).optional(),
});

export const addCandidateSchema = z.object({
  jobOpeningId: z.string().uuid(),
  sectorId: z.string().uuid(),
  fullName: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  resumeUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  source: z.string().optional(),
  currentCompany: z.string().optional(),
  currentPosition: z.string().optional(),
  expectedSalary: z.number().min(0).optional(),
  notes: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Recruitment pipeline
// ---------------------------------------------------------------------------

export const CANDIDATE_STAGES = [
  "applied",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

export const moveCandidateSchema = z.object({
  candidateId: z.string().uuid(),
  stage: z.enum(CANDIDATE_STAGES),
});

export const updateCandidateSchema = z.object({
  candidateId: z.string().uuid(),
  fullName: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  phone: z.string().optional(),
  resumeUrl: z.string().optional(),
  linkedinUrl: z.string().optional(),
  source: z.string().optional(),
  currentCompany: z.string().optional(),
  currentPosition: z.string().optional(),
  expectedSalary: z.number().min(0).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  notes: z.string().optional(),
});

export const addCandidateNoteSchema = z.object({
  candidateId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).optional(),
  body: z.string().min(1, "Comentário é obrigatório"),
});

// ---------------------------------------------------------------------------
// Performance management
// ---------------------------------------------------------------------------

export const createReviewCycleSchema = z.object({
  sectorId: z.string().uuid(),
  name: z.string().min(1, "Nome é obrigatório").max(200),
  description: z.string().optional(),
  startDate: z.string().min(1, "Data de início é obrigatória"),
  endDate: z.string().min(1, "Data de fim é obrigatória"),
});

export const updateReviewCycleStatusSchema = z.object({
  cycleId: z.string().uuid(),
  status: z.enum(["draft", "active", "closed"]),
});

export const upsertEvaluationSchema = z.object({
  cycleId: z.string().uuid(),
  employeeId: z.string().uuid(),
  reviewerId: z.string().uuid().optional(),
  performanceScore: z.number().int().min(1).max(3).optional(),
  potentialScore: z.number().int().min(1).max(3).optional(),
  overallRating: z.number().int().min(1).max(5).optional(),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  comments: z.string().optional(),
  submit: z.boolean().default(false),
});

export const createDevelopmentPlanSchema = z.object({
  sectorId: z.string().uuid(),
  employeeId: z.string().uuid(),
  evaluationId: z.string().uuid().optional(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  objective: z.string().optional(),
  targetDate: z.string().optional(),
});

export const addDevelopmentActionSchema = z.object({
  planId: z.string().uuid(),
  title: z.string().min(1, "Ação é obrigatória"),
  dueDate: z.string().optional(),
});

export const toggleDevelopmentActionSchema = z.object({
  actionId: z.string().uuid(),
  isCompleted: z.boolean(),
});

// ---------------------------------------------------------------------------
// Engagement / climate surveys
// ---------------------------------------------------------------------------

export const createSurveySchema = z.object({
  sectorId: z.string().uuid(),
  title: z.string().min(1, "Título é obrigatório").max(200),
  description: z.string().optional(),
  surveyType: z.enum(["climate", "enps"]).default("climate"),
  questions: z
    .array(
      z.object({
        prompt: z.string().min(1, "Pergunta é obrigatória"),
        questionType: z.enum(["score", "enps", "text"]).default("score"),
      })
    )
    .min(1, "Adicione ao menos uma pergunta"),
});

export const updateSurveyStatusSchema = z.object({
  surveyId: z.string().uuid(),
  status: z.enum(["draft", "open", "closed"]),
});

export const submitSurveyResponseSchema = z.object({
  surveyId: z.string().uuid(),
  answers: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        scoreValue: z.number().int().min(0).max(10).optional(),
        textValue: z.string().optional(),
      })
    )
    .min(1, "Responda ao menos uma pergunta"),
});

export const createOnboardingTemplateSchema = z.object({
  sectorId: z.string().uuid(),
  position: z.string().min(1, "Cargo é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().optional(),
  items: z.array(z.object({
    title: z.string().min(1),
    description: z.string().optional(),
    responsibleRole: z.string().optional(),
    dueDaysAfterHire: z.number().int().min(0).optional(),
  })).default([]),
});
