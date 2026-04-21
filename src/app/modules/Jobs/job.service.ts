import HttpStatus from "http-status";
import { Types } from "mongoose";
import { JwtPayload } from "../../interface/global";
import { JobModel } from "./job.model";
import AppError from "../../erros/AppError";
import QueryBuilder from "../../../builder/QueryBuilder";
import { IJob } from "./job.interface";
import { ProviderModel } from "../Providers/provider.model";

// ─── Create Job (customer) ────────────────────────────────────────────────────
const createJob = async (user: JwtPayload, payload: Partial<IJob>) => {
  const customerId = new Types.ObjectId(user.user);

  // set expiry to 24 hours from now
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const job = await JobModel.create({
    ...payload,
    customerId,
    expiresAt,
  });

  return job;
};

// ─── Get My Jobs (customer) ───────────────────────────────────────────────────
const getMyJobs = async (user: JwtPayload, query: Record<string, unknown>) => {
  const customerId = new Types.ObjectId(user.user);

  const jobQuery = new QueryBuilder(
    JobModel.find({ customerId })
      .populate("selectedProvider", "userId categories trustScore")
      .populate("selectedBid", "price etaMinutes message status"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await jobQuery.countTotal();
  const result = await jobQuery.modelQuery;

  return { meta, result };
};

// ─── Get Job Feed (provider) ──────────────────────────────────────────────────
// shows open and bidding jobs matching provider categories and location
const getJobFeed = async (user: JwtPayload, query: Record<string, unknown>) => {
  const userId = new Types.ObjectId(user.user);

  // get provider categories
  const provider = await ProviderModel.findOne({ userId });
  if (!provider) {
    throw new AppError(HttpStatus.NOT_FOUND, "Provider profile not found");
  }

  if (!provider.categories.length) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Please set your categories first",
    );
  }

  const jobQuery = new QueryBuilder(
    JobModel.find({
      status: { $in: ["open", "bidding"] },
      category: { $in: provider.categories },
    }).populate("customerId", "name avatar location"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await jobQuery.countTotal();
  const result = await jobQuery.modelQuery;

  return { meta, result };
};

// ─── Get Job By ID ────────────────────────────────────────────────────────────
const getJobById = async (jobId: string) => {
  const job = await JobModel.findById(jobId)
    .populate("customerId", "name avatar phone location")
    .populate("selectedProvider", "userId categories trustScore totalJobs")
    .populate("selectedBid", "price etaMinutes message");

  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  return job;
};

// ─── Update Job Status ────────────────────────────────────────────────────────
const updateJobStatus = async (
  user: JwtPayload,
  jobId: string,
  newStatus: IJob["status"],
) => {
  const job = await JobModel.findById(jobId);

  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  const currentStatus = job.status;
  const userId = user.user;
  const userRole = user.role;

  // ─── Validate transitions ──────────────────────────────────────────────────
  const allowedTransitions: Record<string, string[]> = {
    booked: ["in_progress"], // provider only
    in_progress: ["completed", "disputed"], // customer only
  };

  // check if transition is valid
  if (
    allowedTransitions[currentStatus as string] &&
    !allowedTransitions[currentStatus as string].includes(newStatus as string)
  ) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      `Cannot move job from ${currentStatus} to ${newStatus}`,
    );
  }

  // ─── Role based permission checks ─────────────────────────────────────────
  if (newStatus === "in_progress") {
    if (userRole !== "provider") {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        "Only provider can mark job as in progress",
      );
    }
    // make sure this provider is the selected one
    const provider = await ProviderModel.findOne({
      userId: new Types.ObjectId(userId),
    });
    if (
      !provider ||
      !job.selectedProvider?.equals(provider._id as Types.ObjectId)
    ) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        "You are not the assigned provider for this job",
      );
    }
  }

  if (newStatus === "completed" || newStatus === "disputed") {
    if (userRole !== "customer") {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        "Only customer can mark job as completed or disputed",
      );
    }
    if (!job.customerId.equals(new Types.ObjectId(userId))) {
      throw new AppError(
        HttpStatus.FORBIDDEN,
        "You are not the owner of this job",
      );
    }
  }

  const updated = await JobModel.findByIdAndUpdate(
    jobId,
    { $set: { status: newStatus } },
    { new: true },
  );

  return updated;
};

// ─── Cancel Job (customer) ────────────────────────────────────────────────────
const cancelJob = async (user: JwtPayload, jobId: string) => {
  const customerId = new Types.ObjectId(user.user);

  const job = await JobModel.findById(jobId);

  if (!job) {
    throw new AppError(HttpStatus.NOT_FOUND, "Job not found");
  }

  if (!job.customerId.equals(customerId)) {
    throw new AppError(
      HttpStatus.FORBIDDEN,
      "You are not the owner of this job",
    );
  }

  // can only cancel if open or bidding
  if (!["open", "bidding"].includes(job.status as string)) {
    throw new AppError(
      HttpStatus.BAD_REQUEST,
      "Job cannot be cancelled at this stage. Please raise a dispute instead.",
    );
  }

  const updated = await JobModel.findByIdAndUpdate(
    jobId,
    { $set: { status: "cancelled" } },
    { new: true },
  );

  return updated;
};

// ─── Get All Jobs (admin) ─────────────────────────────────────────────────────
const getAllJobs = async (query: Record<string, unknown>) => {
  const jobQuery = new QueryBuilder(
    JobModel.find()
      .populate("customerId", "name email avatar")
      .populate("selectedProvider", "userId trustScore"),
    query,
  )
    .filter()
    .sort()
    .paginate()
    .fields();

  const meta = await jobQuery.countTotal();
  const result = await jobQuery.modelQuery;

  return { meta, result };
};

export const jobServices = {
  createJob,
  getMyJobs,
  getJobFeed,
  getJobById,
  updateJobStatus,
  cancelJob,
  getAllJobs,
};
