// Server function for the /artists directory. The server module is imported dynamically inside
// the handler so it never ends up in the client bundle. It reads only our own store: no request
// to MusicBrainz is made while rendering the directory.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  isLetterKey,
  letterCounts,
  pageOf,
  type DirectoryPage,
  type LetterCount,
} from "./directory";

export interface DirectoryData {
  /** Letters that have artists, with counts (for the jump bar). */
  letters: LetterCount[];
  /** Number of artists in the whole directory. */
  totalAll: number;
  /** The requested page, or null when the letter or page does not exist. */
  page: DirectoryPage | null;
}

export const fetchDirectory = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      letter: z.string().max(10).optional(),
      page: z.number().int().min(1).max(100_000),
    }),
  )
  .handler(async ({ data }): Promise<DirectoryData> => {
    const { getDirectory } = await import("../server/directory.server");
    const sorted = await getDirectory();
    const letter = data.letter && isLetterKey(data.letter) ? data.letter : null;
    // A letter that is not a valid key (or has no artists) is a missing page, not the full list.
    const invalid = data.letter !== undefined && letter === null;
    const page = invalid ? null : pageOf(sorted, letter, data.page);
    return {
      letters: letterCounts(sorted),
      totalAll: sorted.length,
      page: letter && page?.total === 0 ? null : page,
    };
  });
