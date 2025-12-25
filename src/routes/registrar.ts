import express from "express";
import type { Request, Response } from "express";
import { authenticateToken } from "../modules/authentication";
import { checkBodyReturnMissing } from "../modules/common";

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
          errorFrom: "The Server Manager",
          error: "Porkbun API credentials not configured",
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
          errorFrom: "porkbun",
          error: data.message || "Unknown Porkbun error",
        });
      }

      if (data.status !== "SUCCESS") {
        return res.status(500).json({
          errorFrom: "The Server Manager",
          error: "Unexpected response from Porkbun API",
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
      console.error("Error fetching Porkbun domains:", error);
      res.status(500).json({
        errorFrom: "The Server Manager",
        error: "Internal server error",
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
          errorFrom: "The Server Manager",
          error: `Missing ${missingKeys.join(", ")}`,
        });
      }

      // Validate environment variables
      if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_KEY) {
        return res.status(500).json({
          errorFrom: "The Server Manager",
          error: "Porkbun API credentials not configured",
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
          errorFrom: "porkbun",
          error: data.message || "Unknown Porkbun error",
        });
      }

      if (data.status !== "SUCCESS") {
        return res.status(500).json({
          errorFrom: "The Server Manager",
          error: "Unexpected response from Porkbun API",
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
      console.error("Error creating subdomain on Porkbun:", error);
      res.status(500).json({
        errorFrom: "The Server Manager",
        error: "Internal server error",
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
          errorFrom: "The Server Manager",
          error: "Domain parameter is required",
        });
      }

      // Validate environment variables
      if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_KEY) {
        return res.status(500).json({
          errorFrom: "The Server Manager",
          error: "Porkbun API credentials not configured",
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
          errorFrom: "porkbun",
          error: data.message || "Unknown Porkbun error",
        });
      }

      if (data.status !== "SUCCESS") {
        return res.status(500).json({
          errorFrom: "The Server Manager",
          error: "Unexpected response from Porkbun API",
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
      console.error("Error fetching DNS records from Porkbun:", error);
      res.status(500).json({
        errorFrom: "The Server Manager",
        error: "Internal server error",
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
          errorFrom: "The Server Manager",
          error: `Missing ${missingKeys.join(", ")}`,
        });
      }

      // Validate environment variables
      if (!process.env.PORKBUN_API_KEY || !process.env.PORKBUN_SECRET_KEY) {
        return res.status(500).json({
          errorFrom: "The Server Manager",
          error: "Porkbun API credentials not configured",
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
          errorFrom: "porkbun",
          error: data.message || "Unknown Porkbun error",
        });
      }

      if (data.status !== "SUCCESS") {
        return res.status(500).json({
          errorFrom: "The Server Manager",
          error: "Unexpected response from Porkbun API",
        });
      }

      res.json({
        message: "DNS record deleted successfully",
        domain,
        type,
        subdomain,
      });
    } catch (error) {
      console.error("Error deleting DNS record from Porkbun:", error);
      res.status(500).json({
        errorFrom: "The Server Manager",
        error: "Internal server error",
      });
    }
  }
);

export default router;
