import express from 'express';
import crypto from 'crypto';
import Organization from '../models/Organization.js';
import Role from '../models/Role.js';
import Membership from '../models/Membership.js';
import OrganizationInvite from '../models/OrganizationInvite.js';
import User from '../models/User.js';
import authMiddleware from '../middleware/auth.js';
import { getIo } from '../websockets.js';

const router = express.Router();

// Middleware to ensure user has enterprise or agency plan
const checkPlanAbilityToCreateOrg = async (req, res, next) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Allowed plans to create orgs based on user request loosely
        if (['enterprise', 'agency', 'msp', 'partner'].includes(user.planType?.toLowerCase()) || user.role === 'admin') {
            next();
        } else {
            return res.status(403).json({ message: 'Your current plan does not support creating Organizations. Please upgrade.' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Server error verifying plan', error: error.message });
    }
};

// ==========================================
// Organization Management
// ==========================================

// Create a new organization
router.post('/', authMiddleware, checkPlanAbilityToCreateOrg, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ message: 'Organization name is required' });

        const user = await User.findById(req.user.userId);

        const org = new Organization({
            name,
            ownerId: req.user.userId,
            plan: user.planType || 'agency'
        });
        await org.save();

        // Create default "Owner" role
        const ownerRole = new Role({
            organizationId: org._id,
            name: 'Owner',
            permissions: {
                manageContainers: true,
                manageVolumes: true,
                manageNetworks: true,
                viewLogs: true,
                deleteContainers: true,
                deleteVolumes: true,
                deleteNetworks: true
            },
            scope: 'global'
        });
        await ownerRole.save();

        // Automatically add the creator as a member with Owner role
        const membership = new Membership({
            userId: req.user.userId,
            organizationId: org._id,
            roleId: ownerRole._id
        });
        await membership.save();

        res.status(201).json({ organization: org, membership });
    } catch (error) {
        res.status(500).json({ message: 'Server error creating organization', error: error.message });
    }
});

// Get all organizations the current user is a member of
router.get('/my-orgs', authMiddleware, async (req, res) => {
    try {
        const memberships = await Membership.find({ userId: req.user.userId })
            .populate('organizationId', 'name ownerId plan createdAt');

        const orgs = memberships.map(m => m.organizationId).filter(org => org != null);
        res.json({ userId: req.user.userId, orgs });
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching organizations', error: error.message });
    }
});


// ==========================================
// Roles Management (within active organization Context)
// ==========================================

// Require organization context for the following routes
const requireOrgContext = (req, res, next) => {
    if (!req.organization) {
        return res.status(400).json({ message: 'Organization context required. Pass x-organization-id header.' });
    }
    next();
};

// Get all roles
router.get('/:orgId/roles', authMiddleware, requireOrgContext, async (req, res) => {
    try {
        // Confirm requested orgId matches context
        if (req.params.orgId !== req.organization._id.toString()) {
            return res.status(403).json({ message: 'Organization ID mismatch' });
        }

        const roles = await Role.find({ organizationId: req.organization._id });
        res.json(roles);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching roles', error: error.message });
    }
});

// Create new role
const checkOwner = (req, res, next) => {
    if (req.organization.ownerId.toString() !== req.user.userId && (!req.membership?.roleId?.name || req.membership.roleId.name !== 'Owner')) {
        return res.status(403).json({ message: 'Only Organization Owners can manage roles/members.' });
    }
    next();
};

router.post('/:orgId/roles', authMiddleware, requireOrgContext, checkOwner, async (req, res) => {
    try {
        const { name, permissions, scope, resourceIds } = req.body;

        if (!name) return res.status(400).json({ message: 'Role name required' });

        const existingRole = await Role.findOne({ organizationId: req.organization._id, name });
        if (existingRole) return res.status(400).json({ message: 'Role with this name already exists' });

        const role = new Role({
            organizationId: req.organization._id,
            name,
            permissions: permissions || {},
            scope: scope || 'global',
            resourceIds: resourceIds || []
        });

        await role.save();
        res.status(201).json(role);
    } catch (error) {
        res.status(500).json({ message: 'Server error creating role', error: error.message });
    }
});

router.delete('/:orgId/roles/:roleId', authMiddleware, requireOrgContext, checkOwner, async (req, res) => {
    try {
        const role = await Role.findOne({ _id: req.params.roleId, organizationId: req.organization._id });
        if (!role) return res.status(404).json({ message: 'Role not found' });
        if (role.name === 'Owner') return res.status(400).json({ message: 'Cannot delete the Owner role.' });

        // Check if members are using this role
        const usingRoleCount = await Membership.countDocuments({ roleId: role._id });
        if (usingRoleCount > 0) return res.status(400).json({ message: 'Cannot delete a role currently assigned to members' });

        await Role.deleteOne({ _id: role._id });
        res.json({ message: 'Role deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error deleting role', error: error.message });
    }
});

// Update an existing role
router.put('/:orgId/roles/:roleId', authMiddleware, requireOrgContext, checkOwner, async (req, res) => {
    try {
        const { name, permissions, scope, resourceIds } = req.body;

        const role = await Role.findOne({ _id: req.params.roleId, organizationId: req.organization._id });
        if (!role) return res.status(404).json({ message: 'Role not found' });

        if (role.name === 'Owner') return res.status(400).json({ message: 'Cannot modify the system Owner role.' });

        if (name && name !== role.name) {
            const existingRole = await Role.findOne({ organizationId: req.organization._id, name });
            if (existingRole) return res.status(400).json({ message: 'Role with this name already exists' });
            role.name = name;
        }

        if (permissions) role.permissions = permissions;
        if (scope) role.scope = scope;
        if (resourceIds) role.resourceIds = resourceIds;

        await role.save();
        res.json(role);
    } catch (error) {
        res.status(500).json({ message: 'Server error updating role', error: error.message });
    }
});

// ==========================================
// Members Management
// ==========================================

// Get my membership info in this org
router.get('/:orgId/members/me', authMiddleware, requireOrgContext, async (req, res) => {
    try {
        if (req.params.orgId !== req.organization._id.toString()) {
            return res.status(403).json({ message: 'Organization ID mismatch' });
        }
        res.json({ membership: req.membership });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
});

// List members
router.get('/:orgId/members', authMiddleware, requireOrgContext, async (req, res) => {
    try {
        const members = await Membership.find({ organizationId: req.organization._id })
            .populate('userId', 'name email')
            .populate('roleId', 'name permissions');
        res.json(members);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching members', error: error.message });
    }
});

// Remove member
router.delete('/:orgId/members/:membershipId', authMiddleware, requireOrgContext, checkOwner, async (req, res) => {
    try {
        const membership = await Membership.findOne({ _id: req.params.membershipId, organizationId: req.organization._id });
        if (!membership) return res.status(404).json({ message: 'Membership not found' });

        if (membership.userId.toString() === req.organization.ownerId.toString()) {
            return res.status(400).json({ message: 'Cannot remove the primary Organization owner' });
        }

        await Membership.deleteOne({ _id: membership._id });
        res.json({ message: 'Member removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error removing member', error: error.message });
    }
});

// ==========================================
// Invites Management
// ==========================================

router.get('/:orgId/invites', authMiddleware, requireOrgContext, async (req, res) => {
    try {
        const invites = await OrganizationInvite.find({ organizationId: req.organization._id })
            .populate('roleId', 'name');
        res.json(invites);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching invites', error: error.message });
    }
});

router.post('/:orgId/invites', authMiddleware, requireOrgContext, checkOwner, async (req, res) => {
    try {
        const { email, roleId } = req.body;
        if (!email || !roleId) return res.status(400).json({ message: 'Email and Role ID required' });

        // Check if user is already a member by searching by email via User collection first
        const potentialUser = await User.findOne({ email: email.toLowerCase() });
        if (potentialUser) {
            const existingMember = await Membership.findOne({ organizationId: req.organization._id, userId: potentialUser._id });
            if (existingMember) return res.status(400).json({ message: 'User is already a member' });
        }

        // Generate token
        const token = crypto.randomBytes(32).toString('hex');

        // Expires in 7 days
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        const invite = new OrganizationInvite({
            organizationId: req.organization._id,
            email: email.toLowerCase(),
            roleId,
            token,
            expiresAt
        });

        await invite.save();

        // If the user exists in our system, ping them immediately via WebSockets
        if (potentialUser) {
            try {
                const io = getIo();
                const inviteData = await OrganizationInvite.findById(invite._id)
                    .populate('organizationId', 'name')
                    .populate('roleId', 'name');

                io.to(potentialUser._id.toString()).emit('new_invite', {
                    _id: invite._id,
                    organizationName: inviteData.organizationId.name,
                    roleName: inviteData.roleId.name,
                    expiresAt: invite.expiresAt
                });
            } catch (ioErr) {
                console.error('[Websocket Emit Error] Failed to send new_invite:', ioErr);
            }
        }

        res.status(201).json({ invite, message: 'Invite created' });
    } catch (error) {
        res.status(500).json({ message: 'Server error creating invite', error: error.message });
    }
});

// Fetch all invites targeted directly at the current logged-in user
// This looks up invites by the user's registered email
router.get('/my-invites', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const invites = await OrganizationInvite.find({ email: user.email.toLowerCase() })
            .populate('organizationId', 'name')
            .populate('roleId', 'name');

        // Filter out expired invites
        const validInvites = invites.filter(inv => inv.expiresAt >= new Date());

        // Format them for the frontend
        const formatted = validInvites.map(inv => ({
            _id: inv._id,
            organizationName: inv.organizationId?.name,
            roleName: inv.roleId?.name,
            expiresAt: inv.expiresAt
        }));

        res.json(formatted);
    } catch (error) {
        res.status(500).json({ message: 'Server error fetching your invites', error: error.message });
    }
});

// Decline an invite by ID (Requires Auth)
router.post('/invites/:inviteId/decline', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId);
        const invite = await OrganizationInvite.findById(req.params.inviteId);

        if (!invite) return res.status(404).json({ message: 'Invite not found' });

        if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
            return res.status(403).json({ message: 'This invite is for a different email address' });
        }

        await OrganizationInvite.deleteOne({ _id: invite._id });
        res.json({ message: 'Invite declined and removed' });
    } catch (error) {
        res.status(500).json({ message: 'Server error declining invite', error: error.message });
    }
});

// Accept invite by ID (Requires Auth)
router.post('/invites/:inviteId/accept', authMiddleware, async (req, res) => {
    try {
        const invite = await OrganizationInvite.findById(req.params.inviteId);
        if (!invite) return res.status(404).json({ message: 'Invite not found or invalid' });
        if (invite.expiresAt < new Date()) {
            await OrganizationInvite.deleteOne({ _id: invite._id });
            return res.status(400).json({ message: 'Invite has expired' });
        }

        const user = await User.findById(req.user.userId);
        if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
            return res.status(403).json({ message: 'This invite is for a different email address' });
        }

        // Check if already a member somehow
        const existingMember = await Membership.findOne({ organizationId: invite.organizationId._id || invite.organizationId, userId: user._id });
        if (existingMember) {
            await OrganizationInvite.deleteOne({ _id: invite._id });
            return res.status(400).json({ message: 'You are already a member' });
        }

        // Create membership
        const membership = new Membership({
            userId: user._id,
            organizationId: invite.organizationId,
            roleId: invite.roleId
        });
        await membership.save();

        // Delete used invite
        await OrganizationInvite.deleteOne({ _id: invite._id });

        res.json({ message: 'Accepted invite', organizationId: invite.organizationId });
    } catch (error) {
        res.status(500).json({ message: 'Server error accepting invite', error: error.message });
    }
});

// Read invite details (Public route basically, so user knows what they are accepting)
// Put this outside requireOrgContext to allow fetching without headers
router.get('/invite/:token', async (req, res) => {
    try {
        const invite = await OrganizationInvite.findOne({ token: req.params.token })
            .populate('organizationId', 'name')
            .populate('roleId', 'name');

        if (!invite) return res.status(404).json({ message: 'Invite not found or invalid' });
        if (invite.expiresAt < new Date()) {
            await OrganizationInvite.deleteOne({ _id: invite._id });
            return res.status(400).json({ message: 'Invite has expired' });
        }

        res.json({
            email: invite.email,
            organizationName: invite.organizationId.name,
            roleName: invite.roleId.name
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error verifying invite', error: error.message });
    }
});

// Accept invite (Requires Auth)
router.post('/invite/:token/accept', authMiddleware, async (req, res) => {
    try {
        const invite = await OrganizationInvite.findOne({ token: req.params.token });
        if (!invite) return res.status(404).json({ message: 'Invite not found or invalid' });
        if (invite.expiresAt < new Date()) {
            await OrganizationInvite.deleteOne({ _id: invite._id });
            return res.status(400).json({ message: 'Invite has expired' });
        }

        const user = await User.findById(req.user.userId);
        if (user.email.toLowerCase() !== invite.email.toLowerCase()) {
            return res.status(403).json({ message: 'This invite is for a different email address' });
        }

        // Check if already a member somehow
        const existingMember = await Membership.findOne({ organizationId: invite.organizationId._id || invite.organizationId, userId: user._id });
        if (existingMember) {
            await OrganizationInvite.deleteOne({ _id: invite._id });
            return res.status(400).json({ message: 'You are already a member' });
        }

        // Create membership
        const membership = new Membership({
            userId: user._id,
            organizationId: invite.organizationId,
            roleId: invite.roleId
        });
        await membership.save();

        // Delete used invite
        await OrganizationInvite.deleteOne({ _id: invite._id });

        res.json({ message: 'Accepted invite', organizationId: invite.organizationId });
    } catch (error) {
        res.status(500).json({ message: 'Server error accepting invite', error: error.message });
    }
});

export default router;
