import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";
import logger from "../config/logger";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.ADMIN_NODEMAILER_EMAIL_ADDRESS,
    pass: process.env.ADMIN_NODEMAILER_EMAIL_PASSWORD,
  },
});

export const sendResetPasswordEmail = async (
  toEmail: string,
  token: string
): Promise<any> => {
  try {
    const templatePath = path.join(
      __dirname,
      "../templates/resetPasswordLinkEmail.html"
    );

    let emailTemplate = fs.readFileSync(templatePath, "utf8");
    const resetLink = `${process.env.URL_THE404_WEB}/forgot-password/reset/${token}`;

    emailTemplate = emailTemplate.replace("{{resetLink}}", resetLink);

    const mailOptions = {
      from: process.env.ADMIN_EMAIL_ADDRESS,
      to: toEmail,
      subject: "Password Reset Request",
      html: emailTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    logger.info("Email sent:", info.response);
    return info;
  } catch (error) {
    logger.error("Error sending email [sendResetPasswordEmail]:", error);
    throw error;
  }
};
