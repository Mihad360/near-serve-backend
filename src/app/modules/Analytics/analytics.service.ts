// backend/src/modules/Analytics/analytics.service.ts

import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { JobModel } from "../Jobs/job.model";
import { BidModel } from "../Bid/bid.model";
import { ReviewModel } from "../Review/review.model";
import { PaymentModel } from "../Payment/payment.model";
import { ProviderModel } from "../Providers/provider.model";
import AppError from "../../erros/AppError";
import HttpStatus from "http-status";

// ─── Provider Analytics ───────────────────────────────────────────────────────
const getProviderAnalytics = async (user: JwtPayload) => {
  const userId = new Types.ObjectId(user.user);

  const provider = await ProviderModel.findOne({ userId });
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider profile not found");
  }

  const providerId = provider._id as Types.ObjectId;

  // ─── Date ranges ──────────────────────────────────────────────────────────
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // ─── Run all aggregations in parallel ────────────────────────────────────
  const [
    earningsStats,
    monthlyEarnings,
    jobStats,
    monthlyJobs,
    bidStats,
    reviewStats,
    ratingDistribution,
  ] = await Promise.all([
    // ── Earnings summary ───────────────────────────────────────────────────
    PaymentModel.aggregate([
      {
        $match: {
          providerId,
          status: "captured",
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          totalEarnings: { $sum: "$providerPayout" },
          thisMonthEarnings: {
            $sum: {
              $cond: [
                { $gte: ["$capturedAt", startOfThisMonth] },
                "$providerPayout",
                0,
              ],
            },
          },
          lastMonthEarnings: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$capturedAt", startOfLastMonth] },
                    { $lte: ["$capturedAt", endOfLastMonth] },
                  ],
                },
                "$providerPayout",
                0,
              ],
            },
          },
          totalJobs: { $sum: 1 },
        },
      },
    ]),

    // ── Monthly earnings — last 6 months ──────────────────────────────────
    PaymentModel.aggregate([
      {
        $match: {
          providerId,
          status: "captured",
          isDeleted: false,
          capturedAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$capturedAt" },
            month: { $month: "$capturedAt" },
          },
          earnings: { $sum: "$providerPayout" },
          jobCount: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    // ── Job stats ──────────────────────────────────────────────────────────
    JobModel.aggregate([
      {
        $match: { selectedProvider: providerId },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    // ── Monthly jobs completed — last 6 months ────────────────────────────
    JobModel.aggregate([
      {
        $match: {
          selectedProvider: providerId,
          status: "completed",
          updatedAt: { $gte: sixMonthsAgo },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$updatedAt" },
            month: { $month: "$updatedAt" },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),

    // ── Bid stats ──────────────────────────────────────────────────────────
    BidModel.aggregate([
      {
        $match: { providerId },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    // ── Review stats ───────────────────────────────────────────────────────
    ReviewModel.aggregate([
      {
        $match: {
          providerId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: null,
          avgRating: { $avg: "$rating" },
          totalReviews: { $sum: 1 },
        },
      },
    ]),

    // ── Rating distribution ────────────────────────────────────────────────
    ReviewModel.aggregate([
      {
        $match: {
          providerId,
          isDeleted: false,
        },
      },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: -1 } },
    ]),
  ]);

  // ─── Format monthly earnings for chart ───────────────────────────────────
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const formattedMonthlyEarnings = monthlyEarnings.map((m) => ({
    month: `${monthNames[m._id.month - 1]} ${m._id.year}`,
    earnings: parseFloat(m.earnings.toFixed(2)),
    jobs: m.jobCount,
  }));

  const formattedMonthlyJobs = monthlyJobs.map((m) => ({
    month: `${monthNames[m._id.month - 1]} ${m._id.year}`,
    jobs: m.count,
  }));

  // ─── Format job stats ─────────────────────────────────────────────────────
  const jobStatusMap: Record<string, number> = {};
  jobStats.forEach((s) => {
    jobStatusMap[s._id] = s.count;
  });

  // ─── Format bid stats ─────────────────────────────────────────────────────
  const bidStatusMap: Record<string, number> = {};
  bidStats.forEach((s) => {
    bidStatusMap[s._id] = s.count;
  });

  const totalBids = Object.values(bidStatusMap).reduce((a, b) => a + b, 0);
  const acceptedBids = bidStatusMap["accepted"] || 0;
  const winRate =
    totalBids > 0
      ? parseFloat(((acceptedBids / totalBids) * 100).toFixed(1))
      : 0;

  // ─── Format rating distribution ───────────────────────────────────────────
  const ratingMap: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  ratingDistribution.forEach((r) => {
    ratingMap[r._id] = r.count;
  });

  // ─── Earnings comparison ──────────────────────────────────────────────────
  const earnings = earningsStats[0] || {
    totalEarnings: 0,
    thisMonthEarnings: 0,
    lastMonthEarnings: 0,
  };

  const earningsGrowth =
    earnings.lastMonthEarnings > 0
      ? parseFloat(
          (
            ((earnings.thisMonthEarnings - earnings.lastMonthEarnings) /
              earnings.lastMonthEarnings) *
            100
          ).toFixed(1),
        )
      : 0;

  return {
    earnings: {
      total: parseFloat((earnings.totalEarnings || 0).toFixed(2)),
      thisMonth: parseFloat((earnings.thisMonthEarnings || 0).toFixed(2)),
      lastMonth: parseFloat((earnings.lastMonthEarnings || 0).toFixed(2)),
      growthPercent: earningsGrowth,
      monthly: formattedMonthlyEarnings,
    },
    jobs: {
      completed: jobStatusMap["completed"] || 0,
      inProgress: jobStatusMap["in_progress"] || 0,
      booked: jobStatusMap["booked"] || 0,
      disputed: jobStatusMap["disputed"] || 0,
      cancelled: jobStatusMap["cancelled"] || 0,
      monthly: formattedMonthlyJobs,
    },
    bids: {
      total: totalBids,
      accepted: acceptedBids,
      rejected: bidStatusMap["rejected"] || 0,
      pending: bidStatusMap["pending"] || 0,
      withdrawn: bidStatusMap["withdrawn"] || 0,
      winRate,
    },
    reviews: {
      average: parseFloat((reviewStats[0]?.avgRating || 0).toFixed(1)),
      total: reviewStats[0]?.totalReviews || 0,
      distribution: ratingMap,
    },
    profile: {
      trustScore: provider.trustScore,
      completionRate: provider.completionRate,
      avgResponseTime: provider.avgResponseTime,
      totalJobs: provider.totalJobs,
      subscriptionTier: provider.subscriptionTier,
    },
  };
};

// ─── Admin Platform Analytics ─────────────────────────────────────────────────
const getAdminAnalytics = async () => {
  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const { UserModel } = await import("../User/user.model");

  const [userStats, jobStats, revenueStats, monthlyRevenue, topProviders] =
    await Promise.all([
      // ── User stats ────────────────────────────────────────────────────────
      UserModel.aggregate([
        { $match: { isDeleted: false } },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
            thisMonth: {
              $sum: {
                $cond: [{ $gte: ["$createdAt", startOfThisMonth] }, 1, 0],
              },
            },
          },
        },
      ]),

      // ── Job stats ─────────────────────────────────────────────────────────
      JobModel.aggregate([
        {
          $group: {
            _id: "$status",
            count: { $sum: 1 },
          },
        },
      ]),

      // ── Revenue stats ─────────────────────────────────────────────────────
      PaymentModel.aggregate([
        {
          $match: { status: "captured", isDeleted: false },
        },
        {
          $group: {
            _id: null,
            totalVolume: { $sum: "$amount" },
            totalCommission: { $sum: "$actualCommission" },
            thisMonthCommission: {
              $sum: {
                $cond: [
                  { $gte: ["$capturedAt", startOfThisMonth] },
                  "$actualCommission",
                  0,
                ],
              },
            },
            lastMonthCommission: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ["$capturedAt", startOfLastMonth] },
                      { $lte: ["$capturedAt", endOfLastMonth] },
                    ],
                  },
                  "$actualCommission",
                  0,
                ],
              },
            },
          },
        },
      ]),

      // ── Monthly revenue — last 6 months ──────────────────────────────────
      PaymentModel.aggregate([
        {
          $match: {
            status: "captured",
            isDeleted: false,
            capturedAt: { $gte: sixMonthsAgo },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$capturedAt" },
              month: { $month: "$capturedAt" },
            },
            volume: { $sum: "$amount" },
            commission: { $sum: "$actualCommission" },
            transactions: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1 } },
      ]),

      // ── Top 5 providers by earnings ───────────────────────────────────────
      ProviderModel.find({ isApproved: true })
        .populate("userId", "name avatar email")
        .sort({ totalEarnings: -1, trustScore: -1 })
        .limit(5)
        .select("userId totalEarnings trustScore totalJobs completionRate"),
    ]);

  // ─── Format user stats ────────────────────────────────────────────────────
  const userMap: Record<string, { count: number; thisMonth: number }> = {};
  userStats.forEach((u) => {
    userMap[u._id] = { count: u.count, thisMonth: u.thisMonth };
  });

  // ─── Format job stats ─────────────────────────────────────────────────────
  const jobMap: Record<string, number> = {};
  jobStats.forEach((j) => {
    jobMap[j._id] = j.count;
  });

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const formattedMonthlyRevenue = monthlyRevenue.map((m) => ({
    month: `${monthNames[m._id.month - 1]} ${m._id.year}`,
    volume: parseFloat(m.volume.toFixed(2)),
    commission: parseFloat(m.commission.toFixed(2)),
    transactions: m.transactions,
  }));

  const revenue = revenueStats[0] || {
    totalVolume: 0,
    totalCommission: 0,
    thisMonthCommission: 0,
    lastMonthCommission: 0,
  };

  const revenueGrowth =
    revenue.lastMonthCommission > 0
      ? parseFloat(
          (
            ((revenue.thisMonthCommission - revenue.lastMonthCommission) /
              revenue.lastMonthCommission) *
            100
          ).toFixed(1),
        )
      : 0;

  return {
    users: {
      totalCustomers: userMap["customer"]?.count || 0,
      totalProviders: userMap["provider"]?.count || 0,
      newCustomersThisMonth: userMap["customer"]?.thisMonth || 0,
      newProvidersThisMonth: userMap["provider"]?.thisMonth || 0,
    },
    jobs: {
      total: Object.values(jobMap).reduce((a, b) => a + b, 0),
      completed: jobMap["completed"] || 0,
      active: (jobMap["booked"] || 0) + (jobMap["in_progress"] || 0),
      disputed: jobMap["disputed"] || 0,
      open: (jobMap["open"] || 0) + (jobMap["bidding"] || 0),
    },
    revenue: {
      totalVolume: parseFloat((revenue.totalVolume || 0).toFixed(2)),
      totalCommission: parseFloat((revenue.totalCommission || 0).toFixed(2)),
      thisMonth: parseFloat((revenue.thisMonthCommission || 0).toFixed(2)),
      lastMonth: parseFloat((revenue.lastMonthCommission || 0).toFixed(2)),
      growthPercent: revenueGrowth,
      monthly: formattedMonthlyRevenue,
    },
    topProviders,
  };
};

export const analyticsServices = {
  getProviderAnalytics,
  getAdminAnalytics,
};
