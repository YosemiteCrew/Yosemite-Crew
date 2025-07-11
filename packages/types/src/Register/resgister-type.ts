export interface register {
    email?: string,
    password?: string,
    role?: string,
    otp?: string | number,
    subscribe?: boolean
}

export interface invitedTeamMembersInterface {
    email: string,
    password: string,
    role?: string,
    otp?: string | number,
    department?: string,
    invitedBy?: string,
    inviteCode?: string,
}