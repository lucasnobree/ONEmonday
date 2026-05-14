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
