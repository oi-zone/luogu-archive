"use client";

import * as React from "react";

export type BreadcrumbEntry = {
  label: React.ReactNode;
  href?: string;
};

interface BreadcrumbContextValue {
  trail: BreadcrumbEntry[] | null;
  setTrail: React.Dispatch<React.SetStateAction<BreadcrumbEntry[] | null>>;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue | null>(
  null,
);

export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [trail, setTrail] = React.useState<BreadcrumbEntry[] | null>(null);

  const value = React.useMemo(() => ({ trail, setTrail }), [trail]);

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

export function useBreadcrumbContext() {
  const context = React.useContext(BreadcrumbContext);
  if (!context) {
    throw new Error(
      "useBreadcrumbContext must be used within BreadcrumbProvider",
    );
  }
  return context;
}

export function BreadcrumbSetter({
  trail,
}: {
  trail: BreadcrumbEntry[] | null;
}) {
  const { setTrail } = useBreadcrumbContext();

  React.useEffect(() => {
    setTrail(trail);
    return () => setTrail(null);
  }, [trail, setTrail]);

  return null;
}
