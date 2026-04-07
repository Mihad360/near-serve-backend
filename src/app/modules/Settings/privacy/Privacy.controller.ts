import HttpStatus from "http-status";
import sendResponse from "../../../utils/sendResponse";
import { JwtPayload } from "../../../interface/global";
import { privacyServices } from "./Privacy.service";
import catchAsync from "../../../utils/catchAsync";

const createPrivacy = catchAsync(async (req, res) => {
  const result = await privacyServices.createPrivacy(
    req.body,
    req.user as JwtPayload,
  );

  sendResponse(res, {
    statusCode: HttpStatus.CREATED,
    success: true,
    message: "Privacy created successfully",
    data: result,
  });
});

const getAllPrivacy = catchAsync(async (req, res) => {
  const result = await privacyServices.getAllPrivacy();

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Privacy retrieved successfully",
    data: result,
  });
});

const updatePrivacy = catchAsync(async (req, res) => {
  const result = await privacyServices.updatePrivacy(
    req.body,
    req.user as JwtPayload,
  );

  sendResponse(res, {
    statusCode: HttpStatus.OK,
    success: true,
    message: "Privacy updated successfully",
    data: result,
  });
});

const htmlRoute = catchAsync(async (req, res) => {
  const privacy = await privacyServices.getPrivacyHtml();

  res.header("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Privacy Policy</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                line-height: 1.6;
                margin: 0;
                padding: 0;
                background-color: #f4f4f4;
                color: #333;
            }
            .container {
                max-width: 800px;
                margin: 30px auto;
                padding: 20px;
                background: #fff;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            h1 {
                color: #444;
            }
            footer {
                text-align: center;
                margin-top: 30px;
                font-size: 0.9em;
                color: #666;
            }
        </style>
    </head>
    <body>
        <div class="container">
            ${privacy.description}
        </div>
    </body>
    </html>`);
});

const appInstruction = catchAsync(async (req, res) => {
  res.header("Content-Type", "text/html");
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Instruction Guide - Fondation LMS</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            margin: 20px;
            background-color: #f4f4f4;
            color: #333;
        }
        header {
            background-color: #181f81;
            color: white;
            padding: 20px;
            text-align: center;
        }
        section {
            margin: 40px 0;
        }
        h1, h2 {
            color: #181f81;
        }
        ol {
            padding-left: 20px;
            font-size: 1.2rem;
        }
        li {
            margin-bottom: 20px;
        }
        .step-image {
            max-width: 90%;
            height: auto;
            margin: 10px 0;
            border: 1px solid #ddd;
            border-radius: 8px;
        }
        footer {
            text-align: center;
            margin-top: 40px;
            font-size: 0.9em;
            color: #777;
        }
        .step {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            margin-bottom: 20px;
        }
        .step h3 {
            font-size: 1.5rem;
            color: #181f81;
        }
    </style>
</head>
<body>
    <header>
        <h1>Fondation LMS - Account Deletion Guide</h1>
    </header>

    <section style="max-width: 1000px; margin: 0 auto;">
        <h2>Step-by-Step Instructions</h2>
        <ol>
            <li class="step">
                <h3>1. Go to your Profile</h3>
                <p>Navigate to your profile screen after logging in.</p>
                <img src="https://api.fondationlms.org/images/profile.png" height="500" width="400" alt="Profile Screen" class="step-image">
            </li>

            <li class="step">
                <h3>2. Click on Settings</h3>
                <p>Click on the settings icon to access account management options.</p>
                <img src="https://api.fondationlms.org/images/settings.png" height="500" width="400" alt="Settings Screen" class="step-image">
            </li>

            <li class="step">
                <h3>3. Click on the 'Delete Account' Button</h3>
                <p>In the settings menu, you will find the option to delete your account.</p>
                <img src="https://api.fondationlms.org/images/delete-button.png" height="500" width="400" alt="Delete Account Button" class="step-image">
            </li>
 
            <li class="step">
                <h3>4. Confirm by Clicking 'Delete'</h3>
                <p>Finally, click on the 'Delete' button to permanently delete your account.</p>
                <img src="https://api.fondationlms.org/images/delete.png" height="500" width="400" alt="Confirm Delete" class="step-image">
            </li>
        </ol>
    </section>

    <footer>
        <p>&copy; 2025 Fondation LMS. All rights reserved.</p>
    </footer>
</body>
</html>`);
});

export const privacyControllers = {
  createPrivacy,
  getAllPrivacy,
  updatePrivacy,
  htmlRoute,
  appInstruction,
};
