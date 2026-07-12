import { z } from "zod";

export const GlobalSearchQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
});

export type GlobalSearchQuery = z.infer<typeof GlobalSearchQuerySchema>;

/** Uniform shape so the Ctrl+K client can render every group identically. */
export type GlobalSearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export type GlobalSearchResponse = {
  assets: GlobalSearchResult[];
  users: GlobalSearchResult[];
  departments: GlobalSearchResult[];
  organizations: GlobalSearchResult[];
};
