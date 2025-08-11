import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserOrganizations } from '../hooks/queries';
import type { Organization } from '../hooks/queries';

interface OrganizationContextType {
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  userOrganizations: any[] | undefined;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const [currentOrganization, setCurrentOrganization] = useState<Organization | null>(null);
  const { data: userOrganizations, isLoading } = useUserOrganizations();

  useEffect(() => {
    if (userOrganizations && userOrganizations.length > 0 && !currentOrganization) {
      // Set the first organization as default
      setCurrentOrganization(userOrganizations[0].organizations as Organization);
    }
  }, [userOrganizations, currentOrganization]);

  return (
    <OrganizationContext.Provider
      value={{
        currentOrganization,
        setCurrentOrganization,
        userOrganizations,
        isLoading,
      }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
}