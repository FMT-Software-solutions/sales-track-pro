import React, { createContext, useContext, useState, useEffect } from 'react';
import { useUserOrganizations } from '../hooks/queries';
import type { Organization } from '../hooks/queries';

interface OrganizationContextType {
  currentOrganization: Organization | null;
  setCurrentOrganization: (org: Organization | null) => void;
  userOrganizations: any[] | undefined;
  isLoading: boolean;
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(
  undefined
);

export function OrganizationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [
    currentOrganization,
    setCurrentOrganization,
  ] = useState<Organization | null>(null);
  const { data: userOrganizations, isLoading } = useUserOrganizations();

  useEffect(() => {
    if (userOrganizations && userOrganizations.length > 0) {
      // If no current organization is set, set the first one as default
      if (!currentOrganization) {
        setCurrentOrganization(
          userOrganizations[0].organizations as Organization
        );
      } else {
        // If current organization exists, check if it's still in the user's organizations
        // This prevents the organization from disappearing during refresh
        const stillExists = userOrganizations.find(
          (userOrg) => userOrg.organizations.id === currentOrganization.id
        );
        if (!stillExists) {
          // If the current organization no longer exists, set the first available one
          setCurrentOrganization(
            userOrganizations[0].organizations as Organization
          );
        }
      }
    }
  }, [userOrganizations]); // Removed currentOrganization from dependencies to prevent reset loops

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
    throw new Error(
      'useOrganization must be used within an OrganizationProvider'
    );
  }
  return context;
}
