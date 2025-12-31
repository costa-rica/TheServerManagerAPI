import express from "express";
import type { Request, Response } from "express";
import { authenticateToken } from "../modules/authentication";
import { checkBodyReturnMissing } from "../modules/common";
import logger from "../config/logger";

const router = express.Router();

// 🔹 GET /registrar/get-all-porkbun-domains: Fetch all domains from Porkbun
router.get(
  "/get-all-porkbun-domains",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      // Validate environment variables
      if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_KEY) {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "DNS service credentials not configured",
            details:
              process.env.NODE_ENV !== "production"
                ? "Porkbun API credentials not configured"
                : undefined,
            status: 500,
          },
        });
      }

      // Make request to Porkbun API
      const response = await fetch(
        "https://api.porkbun.com/api/json/v3/domain/listAll",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apikey: process.env.PORKBUN_API_KEY,
            secretapikey: process.env.PORKBUN_SECRET_KEY,
          }),
        }
      );

      const data = await response.json();

      // Check if the request was successful
      if (data.status === "ERROR") {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "DNS service error",
            details:
              process.env.NODE_ENV !== "production"
                ? `Porkbun API error: ${data.message || "Unknown error"}`
                : undefined,
            status: 500,
          },
        });
      }

      if (data.status !== "SUCCESS") {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Unexpected DNS service response",
            details:
              process.env.NODE_ENV !== "production"
                ? "Unexpected response from Porkbun API"
                : undefined,
            status: 500,
          },
        });
      }

      // Transform the response to only include domain and status
      const domainsArray = data.domains.map(
        (domain: { domain: string; status: string }) => ({
          domain: domain.domain,
          status: domain.status,
        })
      );

      res.json({ domainsArray });
    } catch (error) {
      logger.error("Error fetching Porkbun domains:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch domains",
          details:
            process.env.NODE_ENV !== "production"
              ? error instanceof Error
                ? error.message
                : "Unknown error"
              : undefined,
          status: 500,
        },
      });
    }
  }
);

// 🔹 POST /registrar/create-subdomain: Create a DNS subdomain record on Porkbun
router.post(
  "/create-subdomain",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { domain, subdomain, publicIpAddress, type } = req.body;

      // Validate required fields
      const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
        "domain",
        "subdomain",
        "publicIpAddress",
        "type",
      ]);

      if (!isValid) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: `Missing required fields: ${missingKeys.join(", ")}`,
            status: 400,
          },
        });
      }

      // Validate environment variables
      if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_KEY) {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "DNS service credentials not configured",
            details:
              process.env.NODE_ENV !== "production"
                ? "Porkbun API credentials not configured"
                : undefined,
            status: 500,
          },
        });
      }

      // Make request to Porkbun API
      const response = await fetch(
        `https://api.porkbun.com/api/json/v3/dns/create/${domain}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apikey: process.env.PORKBUN_API_KEY,
            secretapikey: process.env.PORKBUN_SECRET_KEY,
            name: subdomain,
            type: type,
            content: publicIpAddress,
            ttl: "600",
          }),
        }
      );

      const data = await response.json();

      // Check if the request was successful
      if (data.status === "ERROR") {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "DNS service error",
            details:
              process.env.NODE_ENV !== "production"
                ? `Porkbun API error: ${data.message || "Unknown error"}`
                : undefined,
            status: 500,
          },
        });
      }

      if (data.status !== "SUCCESS") {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Unexpected DNS service response",
            details:
              process.env.NODE_ENV !== "production"
                ? "Unexpected response from Porkbun API"
                : undefined,
            status: 500,
          },
        });
      }

      res.status(201).json({
        message: "Subdomain created successfully",
        recordId: data.id,
        domain,
        subdomain,
        type,
        publicIpAddress,
        ttl: 600,
      });
    } catch (error) {
      logger.error("Error creating subdomain on Porkbun:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to create subdomain",
          details:
            process.env.NODE_ENV !== "production"
              ? error instanceof Error
                ? error.message
                : "Unknown error"
              : undefined,
          status: 500,
        },
      });
    }
  }
);

// 🔹 GET /registrar/get-all-porkbun-subdomains/:domain: Retrieve all DNS records for a domain from Porkbun
router.get(
  "/get-all-porkbun-subdomains/:domain",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { domain } = req.params;

      // Validate domain parameter
      if (!domain) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: "Domain parameter is required",
            status: 400,
          },
        });
      }

      // Validate environment variables
      if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_KEY) {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "DNS service credentials not configured",
            details:
              process.env.NODE_ENV !== "production"
                ? "Porkbun API credentials not configured"
                : undefined,
            status: 500,
          },
        });
      }

      // Make request to Porkbun API
      const response = await fetch(
        `https://api.porkbun.com/api/json/v3/dns/retrieve/${domain}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apikey: process.env.PORKBUN_API_KEY,
            secretapikey: process.env.PORKBUN_SECRET_KEY,
          }),
        }
      );

      const data = await response.json();

      // Check if the request was successful
      if (data.status === "ERROR") {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "DNS service error",
            details:
              process.env.NODE_ENV !== "production"
                ? `Porkbun API error: ${data.message || "Unknown error"}`
                : undefined,
            status: 500,
          },
        });
      }

      if (data.status !== "SUCCESS") {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Unexpected DNS service response",
            details:
              process.env.NODE_ENV !== "production"
                ? "Unexpected response from Porkbun API"
                : undefined,
            status: 500,
          },
        });
      }

      // Transform the response to only include name, type, and content
      const subdomainsArray = data.records.map(
        (record: { name: string; type: string; content: string }) => ({
          name: record.name,
          type: record.type,
          content: record.content,
        })
      );

      res.json({ subdomainsArray });
    } catch (error) {
      logger.error("Error fetching DNS records from Porkbun:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to fetch DNS records",
          details:
            process.env.NODE_ENV !== "production"
              ? error instanceof Error
                ? error.message
                : "Unknown error"
              : undefined,
          status: 500,
        },
      });
    }
  }
);

// 🔹 DELETE /registrar/porkbun-subdomain: Delete a DNS subdomain record from Porkbun
router.delete(
  "/porkbun-subdomain",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      const { domain, type, subdomain } = req.body;

      // Validate required fields
      const { isValid, missingKeys } = checkBodyReturnMissing(req.body, [
        "domain",
        "type",
        "subdomain",
      ]);

      if (!isValid) {
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: "Request validation failed",
            details: `Missing required fields: ${missingKeys.join(", ")}`,
            status: 400,
          },
        });
      }

      // Validate environment variables
      if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_KEY) {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "DNS service credentials not configured",
            details:
              process.env.NODE_ENV !== "production"
                ? "Porkbun API credentials not configured"
                : undefined,
            status: 500,
          },
        });
      }

      // Make request to Porkbun API
      const response = await fetch(
        `https://api.porkbun.com/api/json/v3/dns/deleteByNameType/${domain}/${type}/${subdomain}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            apikey: process.env.PORKBUN_API_KEY,
            secretapikey: process.env.PORKBUN_SECRET_KEY,
          }),
        }
      );

      const data = await response.json();

      // Check if the request was successful
      if (data.status === "ERROR") {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "DNS service error",
            details:
              process.env.NODE_ENV !== "production"
                ? `Porkbun API error: ${data.message || "Unknown error"}`
                : undefined,
            status: 500,
          },
        });
      }

      if (data.status !== "SUCCESS") {
        return res.status(500).json({
          error: {
            code: "INTERNAL_ERROR",
            message: "Unexpected DNS service response",
            details:
              process.env.NODE_ENV !== "production"
                ? "Unexpected response from Porkbun API"
                : undefined,
            status: 500,
          },
        });
      }

      res.json({
        message: "DNS record deleted successfully",
        domain,
        type,
        subdomain,
      });
    } catch (error) {
      logger.error("Error deleting DNS record from Porkbun:", error);
      res.status(500).json({
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to delete DNS record",
          details:
            process.env.NODE_ENV !== "production"
              ? error instanceof Error
                ? error.message
                : "Unknown error"
              : undefined,
          status: 500,
        },
      });
    }
  }
);

export default router;
