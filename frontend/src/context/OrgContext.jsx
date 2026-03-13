import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const OrgContext = createContext();

export const useOrg = () => {
    return useContext(OrgContext);
};

export const OrgProvider = ({ children }) => {
    const [organizations, setOrganizations] = useState([]);
    const [activeOrg, setActiveOrg] = useState(null); // null means personal workspace
    const [membership, setMembership] = useState(null); // Role info for the active org
    const [loadingOrgs, setLoadingOrgs] = useState(true);
    const [userPlan, setUserPlan] = useState(localStorage.getItem('planType')?.toLowerCase() || 'free');

    // Fetch user's organizations on mount
    const fetchOrganizations = async () => {
        setLoadingOrgs(true);
        try {
            const res = await axios.get('/api/organizations/my-orgs');
            setOrganizations(res.data);

            // Re-validate activeOrg if it exists
            const savedOrgId = localStorage.getItem('activeOrgId');
            if (savedOrgId) {
                const foundOrg = res.data.find(org => org._id === savedOrgId);
                if (foundOrg) {
                    setActiveOrg(foundOrg);
                    fetchMembership(foundOrg._id);
                } else {
                    // Not a member anymore or deleted
                    clearActiveOrg();
                }
            } else {
                setMembership(null);
            }
        } catch (error) {
            console.error('Failed to fetch organizations:', error);
            clearActiveOrg();
        } finally {
            setLoadingOrgs(false);
        }
    };

    const fetchMembership = async (orgId) => {
        try {
            const res = await axios.get(`/api/organizations/${orgId}/members/me`);
            setMembership(res.data.membership);
        } catch (error) {
            console.error('Failed to fetch membership info:', error);
            setMembership(null);
        }
    };

    useEffect(() => {
        // Assume AuthContext handles login state. We just fetch whenever mounted for now.
        // In a real scenario, you'd tie this to user login/logout events.
        fetchOrganizations();
    }, []);

    const switchOrganization = (orgId) => {
        if (!orgId) {
            clearActiveOrg();
            return;
        }

        const org = organizations.find(o => o._id === orgId);
        if (org) {
            setActiveOrg(org);
            localStorage.setItem('activeOrgId', org._id);
            fetchMembership(org._id);
        }
    };

    const clearActiveOrg = () => {
        setActiveOrg(null);
        setMembership(null);
        localStorage.removeItem('activeOrgId');
    };

    // Helper function to check permissions based on the active role
    const hasPermission = (permissionName) => {
        if (!activeOrg) return true; // Personal workspace usually has full rights
        if (!membership || !membership.roleId) return false;

        // If the role is explicitly global and has the permission via role scopes/permissions
        // We'll simplify here and assume membership.roleId comes populated with .permissions
        // which we can check. Need to ensure backend populates this.
        const permissions = membership.roleId.permissions || {};
        return !!permissions[permissionName];
    };

    const userId = localStorage.getItem('userId');
    const canManageOrgs = ['enterprise', 'agency', 'msp', 'partner'].includes(userPlan);

    // Filter out owned organizations if plan doesn't support it anymore
    const validOrganizations = organizations.filter(org => {
        if (org.ownerId === userId) return canManageOrgs;
        return true;
    });

    // Clear activeOrg if it becomes invalid (e.g. user downgraded)
    useEffect(() => {
        if (activeOrg && !validOrganizations.find(o => o._id === activeOrg._id)) {
            clearActiveOrg();
        }
    }, [userPlan, organizations]);

    return (
        <OrgContext.Provider
            value={{
                organizations: validOrganizations,
                activeOrg,
                membership,
                loadingOrgs,
                userPlan,
                setUserPlan,
                switchOrganization,
                hasPermission,
                refreshOrgs: fetchOrganizations
            }}
        >
            {children}
        </OrgContext.Provider>
    );
};
