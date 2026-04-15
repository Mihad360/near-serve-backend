import HttpStatus from "http-status";
import AppError from "../../erros/AppError";
import { ProviderModel } from "../Providers/provider.model";
import QueryBuilder from "../../../builder/QueryBuilder";
import { UserModel } from "../User/user.model";

const approveProvider = async (providerId: string) => {
  const provider = await ProviderModel.findById(providerId);
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }
  const updateProvider = await UserModel.findByIdAndUpdate(
    provider.userId,
    {
      isApproved: true,
    },
    { new: true },
  ).select(
    "-fcmToken -password -otp -expiresAt -isVerified -passwordChangedAt",
  );
  if (!updateProvider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider approve failed");
  }
  return updateProvider;
};

const getAllProviders = async (query: Record<string, unknown>) => {
  const providerQuery = new QueryBuilder(
    ProviderModel.find().populate("userId", "name email avatar phone"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await providerQuery.countTotal();
  const result = await providerQuery.modelQuery;

  return { meta, result };
};

export const adminServices = {
  approveProvider,
  getAllProviders,
};
