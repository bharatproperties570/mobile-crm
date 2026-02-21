import api from "./api";

export interface Team {
    _id: string;
    name: string;
    description?: string;
    department?: string;
    isActive?: boolean;
}

export const getTeams = async () => {
    const res = await api.get("/teams");
    return res.data;
};

export const getTeamMembers = async (teamId: string) => {
    // The backend route router.get('/:id/team', getTeamMembers) in user.routes.js
    // is to get users WHO REPORT TO the user with :id.
    // However, the User model has a 'team' field. 
    // We should filter users by team.
    const res = await api.get("/users", { params: { team: teamId, limit: 1000 } });
    return res.data;
};
