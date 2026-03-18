import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import { useToast } from '../components/ToastContext';

const NotificationContext = createContext();

export const useNotifications = () => {
    return useContext(NotificationContext);
};

export const NotificationProvider = ({ children }) => {
    const [invites, setInvites] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [socket, setSocket] = useState(null);
    const { addToast } = useToast();

    // Fetch initial invites
    const fetchInvites = async () => {
        try {
            const res = await axios.get('/api/organizations/my-invites');
            setInvites(res.data);
            setUnreadCount(res.data.length);
        } catch (error) {
            console.error('Failed to fetch invites:', error);
        }
    };

    useEffect(() => {
        // Only fetch if logged in
        if (localStorage.getItem('token')) {
            fetchInvites();
        }

        // Setup Socket
        const newSocket = io('https://localhost:5000', {
            withCredentials: true,
            auth: {
                token: localStorage.getItem('token')
            }
        });

        newSocket.on('connect', () => {
            console.log('[NotificationSocket] Connected');
        });

        newSocket.on('new_invite', (inviteData) => {
            console.log('[NotificationSocket] Received new invite', inviteData);
            setInvites(prev => [...prev, inviteData]);
            setUnreadCount(prev => prev + 1);
            addToast('New Invitation', `You have been invited to join ${inviteData.organizationName}`, 'info');
        });

        newSocket.on('connect_error', (err) => {
            console.error('[NotificationSocket] Connection Error:', err.message);
        });

        setSocket(newSocket);

        return () => {
            newSocket.disconnect();
        };
    }, []);

    const acceptInvite = async (inviteId) => {
        try {
            const res = await axios.post(`/api/organizations/invites/${inviteId}/accept`);
            addToast('Success', 'Accepted invitation!', 'success');
            // Remove from list
            setInvites(prev => prev.filter(inv => inv._id !== inviteId));
            setUnreadCount(prev => Math.max(0, prev - 1));
            return res.data;
        } catch (error) {
            addToast('Error', error.response?.data?.message || 'Failed to accept invite', 'error');
            throw error;
        }
    };

    const declineInvite = async (inviteId) => {
        try {
            await axios.post(`/api/organizations/invites/${inviteId}/decline`);
            addToast('Success', 'Declined invitation', 'info');
            setInvites(prev => prev.filter(inv => inv._id !== inviteId));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            addToast('Error', error.response?.data?.message || 'Failed to decline invite', 'error');
            throw error;
        }
    };

    return (
        <NotificationContext.Provider value={{
            invites,
            unreadCount,
            acceptInvite,
            declineInvite,
            refreshInvites: fetchInvites
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
