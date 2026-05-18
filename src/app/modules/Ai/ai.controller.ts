import HttpStatus from "http-status";
import catchAsync from "../../utils/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { aiServices } from "./ai.service";
import { JwtPayload } from "../../interface/global";

const aiChat = catchAsync(async (req, res) => {
  const result = await aiServices.aiChat(req.body.message);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "AI response generated",
    data: result,
  });
});

const getTrustScore = catchAsync(async (req, res) => {
  const result = await aiServices.getTrustScore(req.params.providerId);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Trust score retrieved",
    data: result,
  });
});

const recalculateAllScores = catchAsync(async (req, res) => {
  const result = await aiServices.recalculateAllScores();

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Trust scores recalculated",
    data: result,
  });
});

const getRecommendations = catchAsync(async (req, res) => {
  const result = await aiServices.getRecommendations(req.user as JwtPayload);

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Recommendations retrieved",
    data: result,
  });
});

export const aiControllers = {
  aiChat,
  getTrustScore,
  recalculateAllScores,
  getRecommendations,
};
