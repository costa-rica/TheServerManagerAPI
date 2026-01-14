import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { User } from "../models/user";

// Extend Request interface to include user property
declare global {
	namespace Express {
		interface Request {
			user?: any;
		}
	}
}

export async function authenticateToken(
	req: Request,
	res: Response,
	next: NextFunction
): Promise<void> {
	if (process.env.AUTHENTIFICATION_TURNED_OFF === "true") {
		const user = await User.findOne({ email: req.body.email });
		req.user = { id: user?.id };
		return next();
	}

	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(" ")[1];
	if (token == null) {
		res.status(401).json({ message: "Token is required" });
		return;
	}

	jwt.verify(token, process.env.JWT_SECRET!, async (err, decoded) => {
		if (err) {
			res.status(403).json({ message: "Invalid token" });
			return;
		}
		const { id } = decoded as { id: number };
		const user = await User.findById(id);
		req.user = user;
		next();
	});
}

export function isAdmin(
	req: Request,
	res: Response,
	next: NextFunction
): void {
	if (!req.user) {
		res.status(401).json({
			error: {
				code: "AUTH_FAILED",
				message: "Authentication required",
				status: 401,
			},
		});
		return;
	}

	if (!req.user.isAdmin) {
		res.status(403).json({
			error: {
				code: "FORBIDDEN",
				message: "Admin access required",
				status: 403,
			},
		});
		return;
	}

	next();
}
