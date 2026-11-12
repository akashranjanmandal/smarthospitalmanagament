import { ROLES } from "@/lib/roles";
import {
  LayoutDashboard,
  Users,
  UserCog,
  CalendarDays,
  FileText,
  Pill,
  IndianRupee,
  Building2,
  Settings,
  Calendar,
  KeyRound,
  BedDouble,
  MessageSquareWarning,
  ClipboardList,
  ArrowLeftRight,
  ScrollText,
  ListOrdered,
  ShieldCheck,
  Tags,
  PillBottle,
  Boxes,
  FlaskConical,
  TestTubes,
  Utensils,
  ChefHat,
  Home,
  UserPlus,
  CalendarPlus,
  FilePlus2,
  BedSingle,
} from "lucide-react";

const adminNavigation = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Hospital",
    items: [
      { title: "Departments", href: "/departments", icon: Building2 },
      { title: "Doctors", href: "/doctors", icon: UserCog },
      { title: "Patients", href: "/patients", icon: Users },
      { title: "Bed Management", href: "/beds", icon: BedDouble },
      { title: "Feedback & Grievances", href: "/feedback/manage", icon: MessageSquareWarning },
    ],
  },
  {
    label: "In-Patient Care",
    items: [
      { title: "In-Patients", href: "/admissions", icon: ClipboardList },
      { title: "Ward Handover", href: "/handover", icon: ArrowLeftRight },
    ],
  },
  {
    label: "Clinical",
    items: [
      { title: "OPD Queue", href: "/queue", icon: ListOrdered },
      { title: "Appointments", href: "/appointments", icon: CalendarDays },
      { title: "Medical Records", href: "/medical-records", icon: FileText },
      { title: "Prescriptions", href: "/prescriptions", icon: Pill },
    ],
  },
  {
    label: "Finance",
    items: [
      { title: "Billing", href: "/billing", icon: IndianRupee },
      { title: "Insurance Desk", href: "/insurance", icon: ShieldCheck },
      { title: "Pharmacy", href: "/pharmacy", icon: PillBottle },
      { title: "Formulary & Stock", href: "/pharmacy/formulary", icon: Boxes },
      { title: "Tariffs", href: "/admin/tariffs", icon: Tags },
    ],
  },
  {
    label: "Diagnostics",
    items: [
      { title: "Lab & Radiology", href: "/lab", icon: FlaskConical },
      { title: "Test Catalogue", href: "/lab/tests", icon: TestTubes },
    ],
  },
  {
    label: "Hospital Services",
    items: [
      { title: "Kitchen & Meals", href: "/kitchen", icon: Utensils },
      { title: "Menu", href: "/kitchen/menu", icon: ChefHat },
    ],
  },
  {
    label: "Administration",
    items: [
      { title: "Registration Codes", href: "/admin/registration-codes", icon: KeyRound },
      { title: "Activity Log", href: "/admin/audit-logs", icon: ScrollText },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const receptionistNavigation = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Front Desk",
    items: [
      { title: "OPD Queue", href: "/queue", icon: ListOrdered },
      { title: "Patients", href: "/patients", icon: Users },
      { title: "Appointments", href: "/appointments", icon: CalendarDays },
      { title: "Admissions", href: "/admissions", icon: ClipboardList },
      { title: "Billing", href: "/billing", icon: IndianRupee },
      { title: "Bed Management", href: "/beds", icon: BedDouble },
      { title: "Feedback & Grievances", href: "/feedback/manage", icon: MessageSquareWarning },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

const doctorNavigation = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Clinical",
    items: [
      { title: "My OPD Queue", href: "/queue", icon: ListOrdered },
      { title: "My Appointments", href: "/appointments", icon: CalendarDays },
      { title: "In-Patients", href: "/admissions", icon: ClipboardList },
      { title: "Ward Handover", href: "/handover", icon: ArrowLeftRight },
      { title: "Medical Records", href: "/medical-records", icon: FileText },
      { title: "Prescriptions", href: "/prescriptions", icon: Pill },
      { title: "Department Grievances", href: "/feedback/manage", icon: MessageSquareWarning },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/profile", icon: Settings },
    ],
  },
];

const patientNavigation = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "My Health",
    items: [
      { title: "Book Appointment", href: "/appointments/new", icon: Calendar },
      { title: "My Appointments", href: "/appointments", icon: CalendarDays },
      { title: "Medical History", href: "/medical-records", icon: FileText },
      { title: "Hospital Stays", href: "/admissions", icon: BedDouble },
      { title: "Lab Reports", href: "/lab-reports", icon: FlaskConical },
      { title: "My Meals", href: "/my-meals", icon: Utensils },
      { title: "Prescriptions", href: "/prescriptions", icon: Pill },
      { title: "Bills", href: "/billing", icon: IndianRupee },
      { title: "Submit Feedback", href: "/feedback", icon: MessageSquareWarning },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/profile", icon: Settings },
    ],
  },
];

const nurseNavigation = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Ward",
    items: [
      { title: "My Ward Patients", href: "/admissions", icon: ClipboardList },
      { title: "Shift Handover", href: "/handover", icon: ArrowLeftRight },
      { title: "Samples to Collect", href: "/lab", icon: TestTubes },
      { title: "Ward Meals", href: "/kitchen", icon: Utensils },
      { title: "Bed Board", href: "/beds", icon: BedDouble },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/profile", icon: Settings },
    ],
  },
];

const wardAttendantNavigation = [
  {
    label: "Overview",
    items: [
      { title: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Ward",
    items: [
      { title: "Bed Board", href: "/beds", icon: BedDouble },
      { title: "Meal Delivery", href: "/kitchen", icon: Utensils },
      { title: "Ward Patients", href: "/admissions", icon: ClipboardList },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/profile", icon: Settings },
    ],
  },
];

const insuranceDeskNavigation = [
  {
    label: "Insurance",
    items: [
      { title: "Worklist", href: "/insurance", icon: ShieldCheck },
      { title: "In-Patients", href: "/admissions", icon: ClipboardList },
      { title: "Patients", href: "/patients", icon: Users },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/profile", icon: Settings },
    ],
  },
];

const pharmacistNavigation = [
  {
    label: "Pharmacy",
    items: [
      { title: "Pharmacy Queue", href: "/pharmacy", icon: PillBottle },
      { title: "Formulary & Stock", href: "/pharmacy/formulary", icon: Boxes },
      { title: "Prescriptions", href: "/prescriptions", icon: Pill },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/profile", icon: Settings },
    ],
  },
];

const labNavigation = [
  {
    label: "Diagnostics",
    items: [
      { title: "Lab Worklist", href: "/lab", icon: FlaskConical },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/profile", icon: Settings },
    ],
  },
];

const kitchenNavigation = [
  {
    label: "Kitchen",
    items: [
      { title: "Meal Lists", href: "/kitchen", icon: Utensils },
      { title: "Menu", href: "/kitchen/menu", icon: ChefHat },
    ],
  },
  {
    label: "Account",
    items: [
      { title: "Profile", href: "/profile", icon: Settings },
    ],
  },
];

const navigationByRole = {
  [ROLES.SUPER_ADMIN]: adminNavigation,
  [ROLES.ADMIN]: adminNavigation,
  [ROLES.RECEPTIONIST]: receptionistNavigation,
  [ROLES.DOCTOR]: doctorNavigation,
  [ROLES.NURSE]: nurseNavigation,
  [ROLES.WARD_ATTENDANT]: wardAttendantNavigation,
  [ROLES.INSURANCE_DESK]: insuranceDeskNavigation,
  [ROLES.PHARMACIST]: pharmacistNavigation,
  [ROLES.LAB_TECH]: labNavigation,
  [ROLES.KITCHEN]: kitchenNavigation,
  [ROLES.PATIENT]: patientNavigation,
};

export function getNavigationForRole(role) {
  return navigationByRole[role] || [];
}

// ─── Wayfinder ─────────────────────────────────────────────────────────────
// The dock shows only a role's everyday places; everything else is one search away.

const PINS = {
  [ROLES.SUPER_ADMIN]: ["/dashboard", "/admissions", "/patients", "/beds"],
  [ROLES.ADMIN]: ["/dashboard", "/admissions", "/patients", "/beds"],
  [ROLES.RECEPTIONIST]: ["/dashboard", "/queue", "/patients", "/admissions"],
  [ROLES.DOCTOR]: ["/dashboard", "/queue", "/admissions", "/medical-records"],
  [ROLES.NURSE]: ["/dashboard", "/admissions", "/handover", "/lab"],
  [ROLES.WARD_ATTENDANT]: ["/dashboard", "/beds", "/kitchen"],
  [ROLES.INSURANCE_DESK]: ["/insurance", "/admissions", "/patients"],
  [ROLES.PHARMACIST]: ["/pharmacy", "/pharmacy/formulary", "/prescriptions"],
  [ROLES.LAB_TECH]: ["/lab", "/profile"],
  [ROLES.KITCHEN]: ["/kitchen", "/kitchen/menu"],
  [ROLES.PATIENT]: ["/dashboard", "/appointments", "/lab-reports", "/billing"],
};

const SHORT = {
  "/dashboard": "Home", "/admissions": "In-patients", "/patients": "Patients", "/beds": "Beds", "/queue": "OPD",
  "/medical-records": "Records", "/handover": "Handover", "/lab": "Lab", "/kitchen": "Meals", "/insurance": "Claims",
  "/pharmacy": "Pharmacy", "/pharmacy/formulary": "Stock", "/prescriptions": "Rx", "/kitchen/menu": "Menu",
  "/appointments": "Visits", "/lab-reports": "Reports", "/billing": "Bills", "/profile": "Profile",
};

export function getPinsForRole(role) {
  const items = getNavigationForRole(role).flatMap((g) => g.items);
  return (PINS[role] ?? []).map((href) => {
    const item = items.find((i) => i.href === href);
    return { href, title: SHORT[href] ?? item?.title ?? href, icon: href === "/dashboard" ? Home : item?.icon ?? Home };
  });
}

const ACTIONS = [
  { title: "Register a patient", href: "/patients/new", icon: UserPlus, roles: [ROLES.SUPER_ADMIN, ROLES.RECEPTIONIST] },
  { title: "Book an appointment", href: "/appointments/new", icon: CalendarPlus, roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR, ROLES.PATIENT] },
  { title: "Admit a patient", href: "/admissions/new", icon: BedSingle, roles: [ROLES.SUPER_ADMIN, ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.DOCTOR] },
  { title: "Write a prescription", href: "/prescriptions/new", icon: FilePlus2, roles: [ROLES.SUPER_ADMIN, ROLES.DOCTOR] },
  { title: "Write a medical record", href: "/medical-records/new", icon: FilePlus2, roles: [ROLES.SUPER_ADMIN, ROLES.DOCTOR] },
];

export function getQuickActionsForRole(role) {
  return ACTIONS.filter((a) => a.roles.includes(role)).map((a) => ({ title: a.title, href: a.href, icon: a.icon }));
}
