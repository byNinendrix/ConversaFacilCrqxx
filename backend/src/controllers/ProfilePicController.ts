import axios from "axios";
import { Request, Response } from "express";

export const proxyProfilePic = async (
  req: Request,
  res: Response
): Promise<void> => {
  const url = String(req.query.url || "");
  if (!url) {
    res.status(400).json({ message: "Missing url parameter." });
    return;
  }

  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "pps.whatsapp.net") {
      res.status(400).json({ message: "Invalid host." });
      return;
    }

    const response = await axios.get(url, {
      responseType: "stream",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
      },
      timeout: 10000
    });

    const contentType = response.headers["content-type"] || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    response.data.pipe(res);
  } catch (error) {
    res.redirect("/nopicture.png");
  }
};

export const serveFallbackImage = async (
  _req: Request,
  res: Response
): Promise<void> => {
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="16" fill="#f2f4f7" />
  <circle cx="64" cy="46" r="26" fill="#d1d5db" />
  <path d="M29 104c0-18 15-32 35-32s35 14 35 32" fill="#d1d5db" />
</svg>`;
  res.setHeader("Content-Type", "image/svg+xml");
  res.send(svg);
};
