import { Router } from "express";

import { publicDemoThemes, publicMusic, publicThemes } from "../controllers/catalogController.js";

export const themeRoutes = Router();
export const musicRoutes = Router();

themeRoutes.get("/", publicThemes);
themeRoutes.get("/public-demo", publicDemoThemes);
musicRoutes.get("/", publicMusic);
