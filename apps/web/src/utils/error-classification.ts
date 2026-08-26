/**
 * Accurate PostgreSQL DDL error classifiers to prevent misreporting missing columns
 * as missing tables/relations in diagnostic guidance banners.
 */

export interface MissingRelationDetails {
  isMissingRelation: boolean;
  relationName?: string;
}

export interface MissingColumnDetails {
  isMissingColumn: boolean;
  columnName?: string;
  relationName?: string;
}

/**
 * Returns true only if the error specifically indicates that a PostgreSQL relation/table does not exist.
 * Explicitly excludes missing columns, constraints, databases, or types.
 */
export function isMissingRelationError(errorMessage?: string | null): boolean {
  if (!errorMessage || typeof errorMessage !== 'string') return false;

  const normalized = errorMessage.trim();

  // Exclude non-table "does not exist" errors
  if (
    /column\s+["']?[^"'\s]+["']?\s+(?:of\s+relation\s+["']?[^"'\s]+["']?\s+)?does not exist/i.test(
      normalized
    )
  ) {
    return false;
  }
  if (/constraint\s+["']?[^"'\s]+["']?\s+does not exist/i.test(normalized)) {
    return false;
  }
  if (/type\s+["']?[^"'\s]+["']?\s+does not exist/i.test(normalized)) {
    return false;
  }
  if (/database\s+["']?[^"'\s]+["']?\s+does not exist/i.test(normalized)) {
    return false;
  }
  if (/schema\s+["']?[^"'\s]+["']?\s+does not exist/i.test(normalized)) {
    return false;
  }

  // Match relation/table missing errors
  return (
    /relation\s+["']?([^"'\s]+)["']?\s+does not exist/i.test(normalized) ||
    /table\s+["']?([^"'\s]+)["']?\s+does not exist/i.test(normalized) ||
    /table\s+["']?([^"'\s]+)["']?\s+not found/i.test(normalized)
  );
}

/**
 * Extracts the missing relation name if present in the error string.
 */
export function extractMissingRelationName(errorMessage?: string | null): string | undefined {
  if (!isMissingRelationError(errorMessage)) return undefined;

  const match =
    errorMessage!.match(/relation\s+["']?([^"'\s]+)["']?\s+does not exist/i) ||
    errorMessage!.match(/table\s+["']?([^"'\s]+)["']?\s+does not exist/i) ||
    errorMessage!.match(/table\s+["']?([^"'\s]+)["']?\s+not found/i);

  return match ? match[1] : undefined;
}

/**
 * Returns true if the error indicates that a column is missing from a table.
 */
export function isMissingColumnError(errorMessage?: string | null): boolean {
  if (!errorMessage || typeof errorMessage !== 'string') return false;

  return /column\s+["']?[^"'\s]+["']?\s+(?:of\s+relation\s+["']?[^"'\s]+["']?\s+)?does not exist/i.test(
    errorMessage
  );
}

/**
 * Extracts missing column and relation names if present.
 */
export function extractMissingColumnDetails(errorMessage?: string | null): MissingColumnDetails {
  if (!isMissingColumnError(errorMessage)) {
    return { isMissingColumn: false };
  }

  const match = errorMessage!.match(
    /column\s+["']?([^"'\s]+)["']?\s+(?:of\s+relation\s+["']?([^"'\s]+)["']?\s+)?does not exist/i
  );

  return {
    isMissingColumn: true,
    columnName: match?.[1],
    relationName: match?.[2],
  };
}
