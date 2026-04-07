import jwt from 'jsonwebtoken';
import Membership from '../models/Membership.js';
import Organization from '../models/Organization.js';

const authMiddleware = async (req, res, next) => {
    try {
        // Fallback to Bearer token for Websockets if needed, but prioritize cookie
        const token = req.cookies?.token || req.header('Authorization')?.replace('Bearer ', '');

        if (!token || token === 'undefined' || token === 'null') {
            return res.status(401).json({ message: 'Authentication required' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');
        req.user = { userId: decoded.userId };

        // Organization Context Logic
        const orgId = req.header('x-organization-id');
        if (orgId) {
            const membership = await Membership.findOne({
                userId: req.user.userId,
                organizationId: orgId
            }).populate('roleId');

            if (!membership) {
                return res.status(403).json({ message: 'Access denied: You are not a member of this organization' });
            }

            const organization = await Organization.findById(orgId);
            if (!organization) {
                return res.status(404).json({ message: 'Organization not found' });
            }

            req.organization = organization;
            req.membership = membership;
        }

        next();
    } catch (error) {
        console.error("Auth Middleware Error:", error);
        res.clearCookie('token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax'
        });
        res.status(401).json({ message: 'Invalid token' });
    }
};

export default authMiddleware;
