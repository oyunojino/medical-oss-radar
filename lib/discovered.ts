import data from "./discovered.json";
import type { Project } from "./projects";

/** Project found by `npm run discover`, not yet hand-reviewed. */
export type DiscoveredProject = Project & {
  /** ISO date (YYYY-MM-DD) the candidate was first picked up. */
  discoveredAt: string;
  /** Where it came from, e.g. "github-topics:dicom" or "awesome-list:awesome-healthcare". */
  source: string;
};

export const discoveredProjects: DiscoveredProject[] =
  data as DiscoveredProject[];
