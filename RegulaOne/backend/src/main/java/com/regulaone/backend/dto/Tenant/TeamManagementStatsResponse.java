package com.regulaone.backend.dto.Tenant;


import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TeamManagementStatsResponse {

    private String tenantName;

    private long totalMembers;

    private long activeMembers;

    private long suspendedMembers;

    private int tierLimit;

    private String seatUsage;

    private int remainingSeats;

    private String currentPlan;


    private long admins;
    // private long activeUsers;
}