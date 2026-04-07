import { AboutModel } from "../modules/Settings/About/About.model";
import { PrivacyModel } from "../modules/Settings/privacy/Privacy.model";
import { TermsModel } from "../modules/Settings/Terms/Terms.model";
import { UserModel } from "../modules/User/user.model";

const dummyPrivacy = {
  description: "dummy privacy and policy",
};
const dummyAbout = {
  description: "dummy about us",
};
const dummyTerms = {
  description: "dummy terms and conditions",
};
const admin = {
  email: "admin@gmail.com",
  password: "123456",
  role: "admin",
  isVerified: true,
  // profilePhotoUrl:
  //   "https://res.cloudinary.com/dmzmx97wn/image/upload/v1754835427/IMG-20250331-WA0261.jpg",
};

export const seedSuperAdmin = async () => {
  try {
    const isSuperAdminExist = await UserModel.findOne({ email: admin.email });
    if (!isSuperAdminExist) {
      await UserModel.create(admin);
      console.log("Super admin created successfully.");
    } else {
      console.log("Super admin already exists.");
    }
  } catch (error) {
    console.error("Error seeding super admin:", error);
    // Optionally: throw error or handle differently
  }
};

export const seedPrivacy = async () => {
  try {
    const privacy = await PrivacyModel.findOne();
    if (!privacy) {
      await PrivacyModel.create(dummyPrivacy);
      console.log("Privacy policy seeded successfully.");
    } else {
      console.log("Privacy policy already exists.");
    }
  } catch (error) {
    console.error("Error seeding privacy policy:", error);
  }
};

export const seedTerms = async () => {
  try {
    const terms = await TermsModel.findOne();
    if (!terms) {
      await TermsModel.create(dummyTerms);
      console.log("Terms and conditions seeded successfully.");
    } else {
      console.log("Terms and conditions already exist.");
    }
  } catch (error) {
    console.error("Error seeding terms and conditions:", error);
  }
};

export const seedAbout = async () => {
  try {
    const about = await AboutModel.findOne();
    if (!about) {
      await AboutModel.create(dummyAbout);
      console.log("About us seeded successfully.");
    } else {
      console.log("About us already exists.");
    }
  } catch (error) {
    console.error("Error seeding about us:", error);
  }
};

export default seedSuperAdmin;
