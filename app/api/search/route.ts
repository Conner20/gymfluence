import { NextResponse } from "next/server";
import { db } from "@/prisma/client";

// Helper to build base filters from query params
function buildFilters(params: any) {
    const filters: any = {};
    if (params.name) {
        filters.OR = [
            { username: { contains: params.name, mode: "insensitive" } },
            { name: { contains: params.name, mode: "insensitive" } }
        ];
    }
    if (params.role) {
        filters.role = params.role;
    }
    return filters;
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const name = searchParams.get("name");
    const role = searchParams.get("role");
    const minBudget = searchParams.get("minBudget");
    const maxBudget = searchParams.get("maxBudget");
    const goals = searchParams.getAll("goal");

    // If no filters are set, return all users (with all profiles)
    const noFilters =
        !name && !role && !minBudget && !maxBudget && goals.length === 0;

    // Include all profiles always for flexibility in frontend rendering
    const profileIncludes = {
        traineeProfile: true,
        trainerProfile: true,
        gymProfile: true,
    };

    if (noFilters) {
        const allUsers = await db.user.findMany({ include: profileIncludes });
        console.log("[API] Returning ALL users:", allUsers.length);
        return NextResponse.json(allUsers);
    }

    // Else, build filter for main user object
    const filters = buildFilters({ name, role });

    // Profile-specific filtering
    let include: any = { ...profileIncludes }; // Always include all profiles for frontend rendering
    let profileWhere: any = {};

    // You may want to further filter users by their profiles if a role is selected and goals/budget are present
    if (role === "TRAINEE") {
        if (goals.length) profileWhere.goals = { hasSome: goals };
        include.traineeProfile = Object.keys(profileWhere).length
            ? { where: profileWhere }
            : true;
    } else if (role === "TRAINER") {
        if (goals.length) profileWhere.services = { hasSome: goals };
        if (minBudget) profileWhere.hourlyRate = { gte: Number(minBudget) };
        if (maxBudget) {
            profileWhere.hourlyRate = {
                ...profileWhere.hourlyRate,
                lte: Number(maxBudget),
            };
        }
        include.trainerProfile = Object.keys(profileWhere).length
            ? { where: profileWhere }
            : true;
    } else if (role === "GYM") {
        if (goals.length) profileWhere.amenities = { hasSome: goals };
        if (minBudget) profileWhere.fee = { gte: Number(minBudget) };
        if (maxBudget) {
            profileWhere.fee = {
                ...profileWhere.fee,
                lte: Number(maxBudget),
            };
        }
        include.gymProfile = Object.keys(profileWhere).length
            ? { where: profileWhere }
            : true;
    }

    const users = await db.user.findMany({
        where: filters,
        include,
    });

    // Optionally filter users by only those who have the relevant profile
    const filtered = role
        ? users.filter(user =>
            (role === "TRAINEE" && user.traineeProfile) ||
            (role === "TRAINER" && user.trainerProfile) ||
            (role === "GYM" && user.gymProfile)
        )
        : users;

    console.log("[API] Returning users after filters:", filtered.length);

    return NextResponse.json(filtered);
}
