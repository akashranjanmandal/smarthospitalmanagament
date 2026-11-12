"use client";

import { createContext, useContext } from "react";

const RoleContext = createContext({
  role: null,
  user: null,
});

export function RoleProvider({ role, user, children }) {
  return (
    <RoleContext.Provider value={{ role, user }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  const role = context?.role || null;
  const isPatient = role === "PATIENT";
  const isDoctor = role === "DOCTOR";
  const isAdmin = role === "ADMIN" || role === "SUPER_ADMIN";
  const isReceptionist = role === "RECEPTIONIST";

  return {
    ...context,
    role,
    isPatient,
    isDoctor,
    isAdmin,
    isReceptionist,
  };
}
