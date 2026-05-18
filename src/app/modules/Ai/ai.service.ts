// backend/src/modules/AI/ai.service.ts

import HttpStatus from "http-status";
import { Types } from "mongoose";
import Groq from "groq-sdk";
import { JwtPayload } from "../../interface/global";
import { JobModel } from "../Jobs/job.model";
import { ProviderModel } from "../Providers/provider.model";
import { ReviewModel } from "../Review/review.model";
import AppError from "../../erros/AppError";
import config from "../../config";

const groq = new Groq({
  apiKey: config.GROQ_API_KEY as string,
});

// ─── Helper — call Groq ───────────────────────────────────────────────────────
const callGroq = async (prompt: string, maxTokens = 500): Promise<string> => {
  const response = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile", // best free model on Groq
    max_tokens: maxTokens,
    messages: [{ role: "user", content: prompt }],
  });

  return response.choices[0]?.message?.content?.trim() || "";
};

// ─── 1. AI Concierge Chatbot ──────────────────────────────────────────────────
const aiChat = async (message: string) => {
  if (!message?.trim()) {
    throw new AppError(HttpStatus.BAD_REQUEST, "Message is required");
  }

  const prompt = `Extract job details from this message and return ONLY a JSON object with no extra text, no markdown, no explanation.

Message: "${message}"

Return this exact JSON structure:
{
  "category": "service category in lowercase (e.g. plumbing, cleaning, electrical)",
  "budget": number or null,
  "location": "city or area name or null",
  "scheduledAt": "date description or null",
  "description": "brief job description"
}

If you cannot extract a field, use null. Category is required.`;

  const rawText = await callGroq(prompt, 300);

  let extractedData: {
    category: string;
    budget: number | null;
    location: string | null;
    scheduledAt: string | null;
    description: string;
  };

  try {
    // remove any accidental markdown backticks
    const clean = rawText.replace(/```json|```/g, "").trim();
    extractedData = JSON.parse(clean);
  } catch {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Could not understand your request. Please be more specific.",
    );
  }

  if (!extractedData.category) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Could not identify the service category.",
    );
  }
  console.log(extractedData);
  const providers = await ProviderModel.find({
    categories: { $in: [extractedData.category.toLowerCase()] },
    stripeAccountStatus: "active",
  })
    .populate("userId", "name avatar phone location")
    .sort({ trustScore: -1 })
    .limit(5);

  return {
    extracted: extractedData,
    providers,
    message:
      providers.length > 0
        ? `Found ${providers.length} providers for ${extractedData.category}`
        : `No providers found for ${extractedData.category} yet`,
  };
};

// ─── 2. Trust Score + AI Summary ─────────────────────────────────────────────
const getTrustScore = async (providerId: string) => {
  const provider = await ProviderModel.findById(providerId);
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  const reviews = await ReviewModel.find({
    providerId: new Types.ObjectId(providerId),
    isDeleted: false,
  });

  const avgRating =
    reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

  const ratingScore = (avgRating / 5) * 100;
  const completionScore = provider.completionRate || 0;
  const responseScore =
    provider.avgResponseTime && provider.avgResponseTime > 0
      ? Math.max(0, 100 - (provider.avgResponseTime / 60) * 100)
      : 100;
  const profileScore =
    [
      provider.bio,
      provider.categories?.length > 0,
      provider.portfolio?.length && provider.portfolio?.length > 0,
    ].filter(Boolean).length *
    (100 / 3);

  const trustScore = Math.round(
    ratingScore * 0.4 +
      completionScore * 0.25 +
      responseScore * 0.15 +
      100 * 0.1 +
      profileScore * 0.1,
  );

  const finalScore = Math.min(100, Math.max(0, trustScore));

  // AI summary
  let summary = "";
  try {
    const prompt = `Generate a 1-2 sentence professional summary for a service provider. Be positive but honest. No markdown, no extra text.

Stats:
- Trust Score: ${finalScore}/100
- Average Rating: ${avgRating.toFixed(1)}/5 from ${reviews.length} reviews
- Completion Rate: ${completionScore}%
- Response Time: ${provider.avgResponseTime} minutes average
- Total Jobs: ${provider.totalJobs}`;

    summary = await callGroq(prompt, 150);
  } catch {
    summary = `This provider has completed ${provider.totalJobs} jobs with a ${completionScore}% completion rate.`;
  }

  return {
    trustScore: finalScore,
    summary,
    breakdown: {
      ratingScore: Math.round(ratingScore),
      completionScore: Math.round(completionScore),
      responseScore: Math.round(responseScore),
      profileScore: Math.round(profileScore),
      totalReviews: reviews.length,
      avgRating: parseFloat(avgRating.toFixed(1)),
    },
  };
};

// ─── 3. Recalculate All Scores (admin) ───────────────────────────────────────
const recalculateAllScores = async () => {
  const providers = await ProviderModel.find({ isApproved: true });

  const results = await Promise.allSettled(
    providers.map((p) => getTrustScore(p._id.toString())),
  );

  return {
    total: providers.length,
    succeeded: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
};

// ─── 4. Recommendations ──────────────────────────────────────────────────────
const getRecommendations = async (user: JwtPayload) => {
  const customerId = new Types.ObjectId(user.user);

  const pastJobs = await JobModel.find({
    customerId,
    status: "completed",
  })
    .select("category")
    .sort({ createdAt: -1 })
    .limit(10);

  if (pastJobs.length === 0) {
    const topProviders = await ProviderModel.find({
      stripeAccountStatus: "active",
    })
      .populate("userId", "name profileImage email")
      .sort({ trustScore: -1 })
      .limit(6);

    return {
      recommendations: topProviders,
      message: "Top rated providers on NearServe",
    };
  }

  const categories = [...new Set(pastJobs.map((j) => j.category))];

  let recommendedCategories: string[] = [];

  try {
    const prompt = `A customer used these services: ${categories.join(", ")}.

Return ONLY a JSON array of 3 service category strings they might need next. Lowercase. No explanation, no markdown.

Example: ["plumbing", "electrical", "cleaning"]`;

    const raw = await callGroq(prompt, 100);
    const clean = raw.replace(/```json|```/g, "").trim();
    recommendedCategories = JSON.parse(clean);
  } catch {
    recommendedCategories = categories.slice(0, 3);
  }

  const providers = await ProviderModel.find({
    categories: { $in: recommendedCategories },
    stripeAccountStatus: "active",
  })
    .populate("userId", "name profileImage email")
    .sort({ trustScore: -1 })
    .limit(6);

  return {
    recommendations: providers,
    recommendedCategories,
    message: "Providers recommended based on your history",
  };
};

export const aiServices = {
  aiChat,
  getTrustScore,
  recalculateAllScores,
  getRecommendations,
};
