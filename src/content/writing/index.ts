import type { ComponentType } from "react";
import MarkedToModel from "./marked-to-model";
import Nanobook from "./nanobook";
import TermPremium from "./term-premium";
import WhoseInflation from "./whose-inflation";

/* Static imports rather than a dynamic path, so a slug in writing.ts with no
   matching essay fails the build instead of 404ing in production. */
export const writingBodies: Record<string, ComponentType> = {
  "marked-to-model": MarkedToModel,
  "whose-inflation": WhoseInflation,
  "term-premium": TermPremium,
  nanobook: Nanobook,
};
