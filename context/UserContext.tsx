import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from "@/services/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface User {
    _id: string;
    id: string;
    fullName: string;
    name: string;
    email: string;
    team?: string;
}

interface UserContextType {
    users: User[];
    teams: any[];
    userIndex: Map<string, User>;
    teamIndex: Map<string, any>;
    loading: boolean;
    findUser: (id: string) => User | undefined;
    findTeam: (id: string) => any | undefined;
    refreshUsers: () => Promise<void>;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [teams, setTeams] = useState<any[]>([]);
    const [userIndex, setUserIndex] = useState<Map<string, User>>(new Map());
    const [teamIndex, setTeamIndex] = useState<Map<string, any>>(new Map());
    const [loading, setLoading] = useState(true);

    const refreshUsers = useCallback(async () => {
        // 1. Try to load from cache first
        if (users.length === 0) {
            try {
                const [cachedUsers, cachedTeams] = await Promise.all([
                    AsyncStorage.getItem("@cache_users"),
                    AsyncStorage.getItem("@cache_teams")
                ]);

                if (cachedUsers) {
                    const parsedUsers = JSON.parse(cachedUsers);
                    setUsers(parsedUsers);
                    const newUIndex = new Map<string, User>();
                    parsedUsers.forEach((u: User) => {
                        if (u._id) newUIndex.set(u._id, u);
                        if (u.id) newUIndex.set(u.id, u);
                    });
                    setUserIndex(newUIndex);
                    setLoading(false); // Stop block spinner early
                }
                if (cachedTeams) {
                    const parsedTeams = JSON.parse(cachedTeams);
                    setTeams(parsedTeams);
                    const newTIndex = new Map<string, any>();
                    parsedTeams.forEach((t: any) => {
                        if (t._id) newTIndex.set(t._id, t);
                        if (t.id) newTIndex.set(t.id, t);
                    });
                    setTeamIndex(newTIndex);
                }
            } catch (e) { console.warn("[UserContext] Cache read failed", e); }
        }

        if (users.length === 0) setLoading(true);
        
        try {
            const [usersRes, teamsRes] = await Promise.all([
                api.get('/users', { params: { limit: 1000 } }),
                api.get('/teams', { params: { limit: 100 } })
            ]);

            const userData = usersRes.data?.records || usersRes.data?.data || (Array.isArray(usersRes.data) ? usersRes.data : []);
            const teamData = teamsRes.data?.records || teamsRes.data?.data || (Array.isArray(teamsRes.data) ? teamsRes.data : []);
            
            if (Array.isArray(userData) && userData.length > 0) {
                setUsers(userData);
                AsyncStorage.setItem("@cache_users", JSON.stringify(userData)).catch(() => {});
                const newUIndex = new Map<string, User>();
                userData.forEach(u => {
                    if (u._id) newUIndex.set(u._id, u);
                    if (u.id) newUIndex.set(u.id, u);
                });
                setUserIndex(newUIndex);
            }

            if (Array.isArray(teamData) && teamData.length > 0) {
                setTeams(teamData);
                AsyncStorage.setItem("@cache_teams", JSON.stringify(teamData)).catch(() => {});
                const newTIndex = new Map<string, any>();
                teamData.forEach(t => {
                    if (t._id) newTIndex.set(t._id, t);
                    if (t.id) newTIndex.set(t.id, t);
                });
                setTeamIndex(newTIndex);
            }
        } catch (error) {
            console.error('[UserContext] Failed to fetch users/teams:', error);
        } finally {
            setLoading(false);
        }
    }, [users.length]);

    useEffect(() => {
        refreshUsers();
    }, [refreshUsers]);

    const findUser = useCallback((id: string) => {
        return userIndex.get(id);
    }, [userIndex]);

    const findTeam = useCallback((id: string) => {
        return teamIndex.get(id);
    }, [teamIndex]);

    return (
        <UserContext.Provider value={{ users, teams, userIndex, teamIndex, loading, findUser, findTeam, refreshUsers }}>
            {children}
        </UserContext.Provider>
    );
};

export const useUsers = () => {
    const context = useContext(UserContext);
    if (!context) {
        throw new Error('useUsers must be used within a UserProvider');
    }
    return context;
};
