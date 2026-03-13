export const checkPermission = (requiredPermission) => {
    return (req, res, next) => {
        // If not acting within an organization, the user is operating on their personal workspace,
        // so no RBAC permissions apply (they have full access to their own stuff)
        if (!req.organization) {
            return next();
        }

        const role = req.membership?.roleId;

        if (!role) {
            return res.status(403).json({ message: 'Access denied: No role assigned in this organization.' });
        }

        // Handle specific scenarios if needed (e.g. Owner always has all permissions)
        // Check if the permission is explicitly granted in the role's permissions object
        if (role.permissions[requiredPermission] !== true) {
            return res.status(403).json({
                message: `Access denied: Your role '${role.name}' does not have the '${requiredPermission}' permission.`
            });
        }

        // Implementation of Resource Scoping (Bonus)
        if (role.scope === 'specific') {
            const requestedResourceId = req.params.id; // Assuming target resource ID is usually passed in URL as :id
            if (requestedResourceId && !role.resourceIds.includes(requestedResourceId)) {
                return res.status(403).json({
                    message: `Access denied: Your role '${role.name}' does not have access to this specific resource.`
                });
            }
        }

        next();
    };
};
