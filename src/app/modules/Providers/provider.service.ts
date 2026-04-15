import HttpStatus from "http-status";
import { ProviderModel } from "./provider.model";
import AppError from "../../erros/AppError";

// ─── Get Single Provider (public) ────────────────────────────────────────────
const getProviderById = async (providerId: string) => {
  const provider = await ProviderModel.findById(providerId).populate(
    "userId",
    "name email avatar phone",
  );

  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider not found");
  }

  return provider;
};

// ─── Search Nearby Providers ──────────────────────────────────────────────────
const searchNearbyProviders = async (
  latitude: number,
  longitude: number,
  radiusKm: number,
  category?: string,
) => {
  const radiusInMeters = radiusKm * 1000;

  const filter: Record<string, unknown> = {
    isApproved: true,
    isAvailable: true,
  };

  if (category) {
    filter.categories = { $in: [category.toLowerCase()] };
  }

  const providers = await ProviderModel.find(filter)
    .populate({
      path: "userId",
      select: "name email avatar phone location",
      match: {
        location: {
          $near: {
            $geometry: {
              type: "Point",
              coordinates: [longitude, latitude],
            },
            $maxDistance: radiusInMeters,
          },
        },
      },
    })
    .sort({ trustScore: -1 });

  const nearby = providers.filter((p) => p.userId !== null);

  return nearby;
};

export const providerServices = {
  getProviderById,
  searchNearbyProviders,
};
