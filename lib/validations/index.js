import { z } from "zod";

export const departmentSchema = z.object({
  name: z
    .string()
    .min(2, "Department name must be at least 2 characters")
    .max(100, "Department name must be less than 100 characters"),
  description: z
    .string()
    .max(500, "Description must be less than 500 characters")
    .optional()
    .or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
});

export const doctorSchema = z.object({
  email: z.string().email("Valid email is required"),
  firstName: z.string().min(2, "First name is required").max(50),
  lastName: z.string().min(2, "Last name is required").max(50),
  departmentId: z.string().min(1, "Department is required"),
  specialization: z.string().min(2, "Specialization is required").max(100),
  qualification: z.string().min(2, "Qualification is required").max(200),
  experience: z.coerce.number().min(0, "Experience must be 0 or more").max(70),
  phone: z
    .string()
    .min(10, "Phone must be at least 10 digits")
    .max(15, "Phone must be less than 15 digits"),
  available: z.boolean().default(true),
});

export const patientSchema = z.object({
  email: z.string().email("A valid email address is required").optional().or(z.literal("")),
  firstName: z.string().min(2, "First name is required").max(50),
  lastName: z.string().min(2, "Last name is required").max(50),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  bloodGroup: z.string().optional().or(z.literal("")),
  phone: z.string().regex(/^\+?[0-9\s()-]{10,20}$/, "Enter a valid phone number"),
  emergencyContact: z.string().max(15).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
});

export const appointmentSchema = z.object({
  doctorId: z.string().min(1, "Doctor is required"),
  patientId: z.string().min(1, "Patient is required"),
  appointmentDate: z.string().min(1, "Appointment date is required"),
  appointmentTime: z.string().min(1, "Appointment time is required"),
  reason: z.string().max(500).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

export const wardSchema = z.object({
  name: z
    .string()
    .min(2, "Ward name must be at least 2 characters")
    .max(100, "Ward name must be less than 100 characters"),
  floor: z.coerce.number().min(0, "Floor must be 0 or more").max(50, "Floor must be less than 50"),
  departmentId: z.string().min(1, "Department is required"),
  genderWard: z.enum(["MALE", "FEMALE", "MIXED"]).default("MIXED"),
});

export const bedStatusUpdateSchema = z.object({
  status: z.enum(["VACANT", "OCCUPIED", "RESERVED", "NEEDS_CLEANING"]),
  patientId: z.string().optional().or(z.literal("")),
  notes: z.string().max(500).optional().or(z.literal("")),
});

export const complaintSubmissionSchema = z.object({
  type: z.enum(["COMPLAINT", "FEEDBACK", "COMPLIMENT", "SUGGESTION"]).default("COMPLAINT"),
  category: z.enum([
    "STAFF_BEHAVIOR",
    "WAIT_TIME",
    "CLEANLINESS",
    "BILLING_ISSUE",
    "TREATMENT_QUALITY",
    "FACILITY_AMENITIES",
    "MEDICATION_ERROR",
    "OTHER",
  ]),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).default("MEDIUM"),
  title: z.string().min(4, "Title must be at least 4 characters").max(120, "Title is too long"),
  description: z.string().min(10, "Please provide at least 10 characters of detail").max(2000),
  location: z.string().max(100).optional().or(z.literal("")),
  departmentId: z.string().min(1, "Please select the concerned department"),
  doctorId: z.string().optional().or(z.literal("")),
  isAnonymous: z.boolean().default(false),
  patientName: z.string().max(100).optional().or(z.literal("")),
  patientPhone: z.string().max(20).optional().or(z.literal("")),
  patientEmail: z.string().email().optional().or(z.literal("")),
});

export const complaintResolutionSchema = z.object({
  status: z.enum(["UNDER_INVESTIGATION", "RESOLVED", "REJECTED", "CLOSED"]),
  resolutionSummary: z.string().min(5, "Please provide a resolution summary").max(1500),
  actionTaken: z.string().max(1000).optional().or(z.literal("")),
});

