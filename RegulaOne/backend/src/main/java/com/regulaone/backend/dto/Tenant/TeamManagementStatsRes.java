package com.regulaone.backend.dto.Tenant;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TeamManagementStatsRes {

    private long totalUsers;

    private long activeUsers;

    private long suspendedUsers;

    private long admins;
}