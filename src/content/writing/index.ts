import type { ComponentType } from "react";
import MarkedToModel from "./marked-to-model";

/* Static imports rather than a dynamic path, so a slug in writing.ts with no
   matching essay fails the build instead of 404ing in production. */
export const writingBodies: Record<string, ComponentType> = {
  "marked-to-model": MarkedToModel,
};
