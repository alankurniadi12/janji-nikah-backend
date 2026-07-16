import { Router } from "express";
import mongoose from "mongoose";

export const healthRoutes = Router();

healthRoutes.get("/", (req, res) => {
  res.json({
    success: true,
    data: {
      service: "janji-nikah-backend",
      status: "ok",
      database: mongoose.connection.readyState === 1 ? "connected" : "disconnected"
    }
  });
});
